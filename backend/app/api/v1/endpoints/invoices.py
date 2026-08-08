import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.core.database import get_db
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException, CRMException
from app.api.deps import get_current_user, get_user_client_id, require_roles, ADMIN_ROLES, SUPER_ADMIN_ROLES, ALL_ROLES
from app.models.invoices import Invoice, InvoicePayment, InvoiceStatusEnum
from app.models.clients import Client
from app.models.projects import Project
from app.models.audit import AuditLog
from app.models.role import UserRoleEnum
from app.models.user import User
from app.schemas.common import ResponseEnvelope, PaginatedResponse, PaginationMeta
from app.schemas.invoices import (
    InvoiceRead,
    InvoiceDetailRead,
    InvoiceCreate,
    InvoiceUpdate,
    InvoicePaymentCreate,
    InvoicePaymentRead,
)
from app.schemas.audit import AuditLogRead
from app.services.audit_service import log_audit_event
from app.services.pdf_service import generate_invoice_pdf

router = APIRouter()


def invoice_options_loader():
    return [
        selectinload(Invoice.client).selectinload(Client.assigned_admin).selectinload(User.role),
        selectinload(Invoice.client).selectinload(Client.account_manager).selectinload(User.role),
        selectinload(Invoice.client).selectinload(Client.contacts),
        selectinload(Invoice.project),
        selectinload(Invoice.assigned_admin).selectinload(User.role),
    ]


def generate_invoice_number() -> str:
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:6].upper()
    return f"INV-{now_str}-{short_uuid}"


@router.get("", response_model=PaginatedResponse[InvoiceRead])
async def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search across invoice number, notes, or client name"),
    status_filter: Optional[InvoiceStatusEnum] = Query(None, alias="status"),
    client_id: Optional[UUID] = Query(None),
    project_id: Optional[UUID] = Query(None),
    overdue_only: bool = Query(False),
    include_deleted: bool = Query(False),
    only_deleted: bool = Query(False),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Invoice).options(*invoice_options_loader())

    if only_deleted:
        query = query.where(Invoice.is_deleted == True)
    elif not include_deleted:
        query = query.join(Invoice.client).where(Invoice.is_deleted == False, Client.is_deleted == False)

    # Enforce backend-level client data isolation
    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id:
        query = query.where(Invoice.client_id == user_client_id)
    elif client_id:
        query = query.where(Invoice.client_id == client_id)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.join(Invoice.client).where(
            or_(
                Invoice.invoice_number.ilike(search_fmt),
                Invoice.notes.ilike(search_fmt),
                Client.name.ilike(search_fmt),
            )
        )

    if status_filter:
        query = query.where(Invoice.status == status_filter)

    if client_id:
        query = query.where(Invoice.client_id == client_id)

    if project_id:
        query = query.where(Invoice.project_id == project_id)

    if overdue_only:
        now = datetime.now(timezone.utc)
        query = query.where(
            Invoice.due_date < now,
            Invoice.status.not_in([InvoiceStatusEnum.PAID, InvoiceStatusEnum.CANCELLED])
        )

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Sort & Paginate
    sort_column = getattr(Invoice, sort_by, Invoice.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    invoices = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        success=True,
        data=[InvoiceRead.model_validate(inv) for inv in invoices],
        meta=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )
    )


@router.post("", response_model=ResponseEnvelope[InvoiceRead], status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt_client = select(Client).where(Client.id == payload.client_id, Client.is_deleted == False)
    res_client = await db.execute(stmt_client)
    if not res_client.scalar_one_or_none():
        raise NotFoundException(detail="Target client profile not found")

    code = payload.invoice_number or generate_invoice_number()

    # Financial calculations
    tax_amount = round(payload.subtotal * (payload.tax_rate / 100.0), 2)
    total_amount = round(payload.subtotal + tax_amount, 2)
    paid_amount = 0.0
    outstanding_amount = total_amount

    new_invoice = Invoice(
        invoice_number=code,
        issue_date=payload.issue_date or datetime.now(timezone.utc),
        due_date=payload.due_date,
        currency=payload.currency or "INR",
        subtotal=payload.subtotal,
        tax_rate=payload.tax_rate,
        tax_amount=tax_amount,
        total_amount=total_amount,
        paid_amount=paid_amount,
        outstanding_amount=outstanding_amount,
        status=payload.status,
        notes=payload.notes,
        client_id=payload.client_id,
        project_id=payload.project_id,
        assigned_admin_id=payload.assigned_admin_id or current_user.id,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(new_invoice)
    await db.commit()

    await log_audit_event(
        db=db,
        action="INVOICE_CREATED",
        entity_name="Invoice",
        entity_id=str(new_invoice.id),
        changes={
            "invoice_number": new_invoice.invoice_number,
            "total_amount": new_invoice.total_amount,
            "client_id": str(new_invoice.client_id),
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    stmt = select(Invoice).options(*invoice_options_loader()).where(Invoice.id == new_invoice.id)
    res = await db.execute(stmt)
    created_inv = res.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Manual invoice created successfully",
        data=InvoiceRead.model_validate(created_inv)
    )


@router.get("/{invoice_id}", response_model=ResponseEnvelope[InvoiceDetailRead])
async def get_invoice_by_id(
    invoice_id: UUID,
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    loader = invoice_options_loader() + [
        selectinload(Invoice.payments).selectinload(InvoicePayment.recorded_by).selectinload(User.role)
    ]
    stmt = select(Invoice).options(*loader).where(Invoice.id == invoice_id)

    if not include_deleted:
        stmt = stmt.where(Invoice.is_deleted == False)

    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()

    if not invoice:
        raise NotFoundException(detail="Invoice record not found")

    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id and invoice.client_id != user_client_id:
        raise ForbiddenException(detail="Access Denied: You do not have permission to view billing records belonging to another client.")

    detail = InvoiceDetailRead.model_validate(invoice)
    detail.payments = [InvoicePaymentRead.model_validate(p) for p in (invoice.payments or [])]

    return ResponseEnvelope(
        success=True,
        data=detail
    )


@router.put("/{invoice_id}", response_model=ResponseEnvelope[InvoiceRead])
@router.patch("/{invoice_id}", response_model=ResponseEnvelope[InvoiceRead])
async def update_invoice(
    invoice_id: UUID,
    payload: InvoiceUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Invoice).options(*invoice_options_loader()).where(Invoice.id == invoice_id, Invoice.is_deleted == False)
    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()

    if not invoice:
        raise NotFoundException(detail="Invoice record not found")

    changes = {}
    update_data = payload.model_dump(exclude_unset=True)

    for field, new_val in update_data.items():
        if hasattr(invoice, field):
            old_val = getattr(invoice, field)
            old_str = old_val.value if hasattr(old_val, "value") else (str(old_val) if isinstance(old_val, UUID) else old_val)
            new_str = new_val.value if hasattr(new_val, "value") else (str(new_val) if isinstance(new_val, UUID) else new_val)

            if old_str != new_str:
                changes[field] = {"old": old_str, "new": new_str}
                setattr(invoice, field, new_val)

    # Recalculate financial breakdown if subtotal or tax_rate changed
    if "subtotal" in update_data or "tax_rate" in update_data:
        invoice.tax_amount = round(invoice.subtotal * (invoice.tax_rate / 100.0), 2)
        invoice.total_amount = round(invoice.subtotal + invoice.tax_amount, 2)
        invoice.outstanding_amount = round(max(0.0, invoice.total_amount - invoice.paid_amount), 2)

    if changes:
        invoice.updated_by_id = current_user.id
        await log_audit_event(
            db=db,
            action="INVOICE_UPDATED",
            entity_name="Invoice",
            entity_id=str(invoice.id),
            changes=changes,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        await db.refresh(invoice)

    return ResponseEnvelope(
        success=True,
        message="Invoice updated successfully",
        data=InvoiceRead.model_validate(invoice)
    )


@router.post("/{invoice_id}/payments", response_model=ResponseEnvelope[InvoiceDetailRead])
async def record_manual_payment(
    invoice_id: UUID,
    payload: InvoicePaymentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    loader = invoice_options_loader() + [
        selectinload(Invoice.payments).selectinload(InvoicePayment.recorded_by).selectinload(User.role)
    ]
    stmt = select(Invoice).options(*loader).where(Invoice.id == invoice_id, Invoice.is_deleted == False)
    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()

    if not invoice:
        raise NotFoundException(detail="Invoice record not found")

    new_payment = InvoicePayment(
        invoice_id=invoice.id,
        payment_amount=payload.payment_amount,
        payment_date=payload.payment_date or datetime.now(timezone.utc),
        payment_method=payload.payment_method,
        reference_number=payload.reference_number,
        notes=payload.notes,
        recorded_by_id=current_user.id,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(new_payment)

    # Financial math update
    invoice.paid_amount = round(invoice.paid_amount + payload.payment_amount, 2)
    invoice.outstanding_amount = round(max(0.0, invoice.total_amount - invoice.paid_amount), 2)

    if invoice.outstanding_amount <= 0:
        invoice.status = InvoiceStatusEnum.PAID
        invoice.paid_at = datetime.now(timezone.utc)
    else:
        invoice.status = InvoiceStatusEnum.PARTIALLY_PAID

    invoice.updated_by_id = current_user.id

    await log_audit_event(
        db=db,
        action="INVOICE_PAYMENT_RECORDED",
        entity_name="Invoice",
        entity_id=str(invoice.id),
        changes={
            "payment_amount": payload.payment_amount,
            "payment_method": payload.payment_method,
            "reference_number": payload.reference_number,
            "new_paid_amount": invoice.paid_amount,
            "new_outstanding": invoice.outstanding_amount,
            "status": invoice.status.value,
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(invoice)

    detail = InvoiceDetailRead.model_validate(invoice)
    detail.payments = [InvoicePaymentRead.model_validate(p) for p in (invoice.payments or [])]

    return ResponseEnvelope(
        success=True,
        message=f"Manual payment of {invoice.currency} {payload.payment_amount:,.2f} recorded successfully",
        data=detail
    )


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES))
):
    stmt = select(Invoice).options(*invoice_options_loader()).where(Invoice.id == invoice_id, Invoice.is_deleted == False)
    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()

    if not invoice:
        raise NotFoundException(detail="Invoice record not found")

    pdf_path = generate_invoice_pdf(invoice)
    invoice.pdf_file_path = pdf_path
    await db.commit()

    await log_audit_event(
        db=db,
        action="INVOICE_PDF_GENERATED",
        entity_name="Invoice",
        entity_id=str(invoice.id),
        changes={"pdf_file_path": pdf_path},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    filename = f"Invoice_{invoice.invoice_number}.pdf"
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{invoice_id}/audit-logs", response_model=PaginatedResponse[AuditLogRead])
async def get_invoice_audit_logs(
    invoice_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES))
):
    stmt_target = select(Invoice).where(Invoice.id == invoice_id)
    res_target = await db.execute(stmt_target)
    if not res_target.scalar_one_or_none():
        raise NotFoundException(detail="Invoice record not found")

    query = select(AuditLog).options(
        selectinload(AuditLog.user).selectinload(User.role)
    ).where(
        AuditLog.entity_name == "Invoice",
        AuditLog.entity_id == str(invoice_id)
    )

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    audit_logs = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        success=True,
        data=[AuditLogRead.model_validate(log) for log in audit_logs],
        meta=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )
    )


@router.delete("/{invoice_id}", response_model=ResponseEnvelope[dict])
async def delete_invoice(
    invoice_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRoleEnum.SUPER_ADMIN]))
):
    stmt = select(Invoice).where(Invoice.id == invoice_id, Invoice.is_deleted == False)
    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()

    if not invoice:
        raise NotFoundException(detail="Invoice record not found")

    invoice.soft_delete(user_id=current_user.id)
    await log_audit_event(
        db=db,
        action="INVOICE_SOFT_DELETED",
        entity_name="Invoice",
        entity_id=str(invoice.id),
        changes={"is_deleted": {"old": False, "new": True}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Invoice soft-deleted successfully",
        data={"deleted": True, "id": str(invoice_id)}
    )


@router.post("/{invoice_id}/restore", response_model=ResponseEnvelope[InvoiceRead])
async def restore_invoice(
    invoice_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Invoice).options(*invoice_options_loader()).where(Invoice.id == invoice_id, Invoice.is_deleted == True)
    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()

    if not invoice:
        raise NotFoundException(detail="Soft-deleted invoice record not found")

    invoice.restore()
    invoice.updated_by_id = current_user.id
    await log_audit_event(
        db=db,
        action="INVOICE_RESTORED",
        entity_name="Invoice",
        entity_id=str(invoice.id),
        changes={"is_deleted": {"old": True, "new": False}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(invoice)

    return ResponseEnvelope(
        success=True,
        message="Invoice record restored successfully",
        data=InvoiceRead.model_validate(invoice)
    )
