import hashlib
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.core.database import get_db
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException, CRMException
from app.api.deps import get_current_user, get_user_client_id, require_roles, ADMIN_ROLES, SUPER_ADMIN_ROLES, ALL_ROLES
from app.models.agreements import Agreement, AgreementStatusEnum, ConsentStatusEnum, AgreementTypeEnum
from app.models.clients import Client
from app.models.audit import AuditLog
from app.models.role import UserRoleEnum
from app.models.user import User
from app.schemas.common import ResponseEnvelope, PaginatedResponse, PaginationMeta, build_paginated_response
from app.repositories import agreement_repository
from app.schemas.agreements import (
    AgreementRead,
    AgreementDetailRead,
    AgreementCreate,
    AgreementUpdate,
    AgreementSignPayload,
    AgreementConsentPayload,
    AgreementCreateVersionPayload,
    AgreementVersionRead,
)
from app.schemas.audit import AuditLogRead
from app.services.audit_service import log_audit_event

router = APIRouter()

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "agreements")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def agreement_options_loader():
    return [
        selectinload(Agreement.client).selectinload(Client.assigned_admin).selectinload(User.role),
        selectinload(Agreement.client).selectinload(Client.account_manager).selectinload(User.role),
        selectinload(Agreement.client).selectinload(Client.contacts),
        selectinload(Agreement.assigned_admin).selectinload(User.role),
    ]


def generate_agreement_number() -> str:
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:6].upper()
    return f"AGR-{now_str}-{short_uuid}"


@router.get("", response_model=PaginatedResponse[AgreementRead])
async def list_agreements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by title, agreement number, or file name"),
    status_filter: Optional[AgreementStatusEnum] = Query(None, alias="status"),
    consent_status_filter: Optional[ConsentStatusEnum] = Query(None, alias="consent_status"),
    type_filter: Optional[AgreementTypeEnum] = Query(None, alias="type"),
    client_id: Optional[UUID] = Query(None),
    assigned_admin_id: Optional[UUID] = Query(None),
    include_deleted: bool = Query(False),
    only_deleted: bool = Query(False),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_client_id = await get_user_client_id(current_user, db)
    target_client_id = user_client_id or client_id

    agreements, total = await agreement_repository.list_agreements_paginated(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status_filter,
        agreement_type=type_filter,
        consent_status=consent_status_filter,
        client_id=target_client_id,
        include_deleted=include_deleted,
        only_deleted=only_deleted,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return build_paginated_response(
        items=[AgreementRead.model_validate(a) for a in agreements],
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("", response_model=ResponseEnvelope[AgreementRead], status_code=status.HTTP_201_CREATED)
async def create_agreement(
    payload: AgreementCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    # Verify client exists
    stmt_client = select(Client).where(Client.id == payload.client_id, Client.is_deleted == False)
    res_client = await db.execute(stmt_client)
    if not res_client.scalar_one_or_none():
        raise NotFoundException(detail="Target client profile not found")

    agr_number = payload.agreement_number or generate_agreement_number()

    # Ensure agreement_number uniqueness
    stmt_exists = select(Agreement).where(Agreement.agreement_number == agr_number)
    res_exists = await db.execute(stmt_exists)
    if res_exists.scalar_one_or_none():
        raise ConflictException(detail=f"Agreement number '{agr_number}' already exists")

    new_agreement = Agreement(
        title=payload.title,
        agreement_number=agr_number,
        type=payload.type,
        status=AgreementStatusEnum.DRAFT,
        consent_status=ConsentStatusEnum.PENDING,
        version=1,
        description=payload.description,
        effective_date=payload.effective_date,
        expiration_date=payload.expiration_date,
        client_id=payload.client_id,
        assigned_admin_id=payload.assigned_admin_id or current_user.id,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(new_agreement)
    await db.commit()

    # Log audit event
    await log_audit_event(
        db=db,
        action="AGREEMENT_CREATED",
        entity_name="Agreement",
        entity_id=str(new_agreement.id),
        changes={
            "title": new_agreement.title,
            "agreement_number": new_agreement.agreement_number,
            "client_id": str(new_agreement.client_id),
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    # Load relationships
    stmt = select(Agreement).options(*agreement_options_loader()).where(Agreement.id == new_agreement.id)
    res = await db.execute(stmt)
    created_agr = res.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Agreement created successfully",
        data=AgreementRead.model_validate(created_agr)
    )


@router.post("/{agreement_id}/upload-pdf", response_model=ResponseEnvelope[AgreementRead])
async def upload_agreement_pdf(
    agreement_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Agreement).options(*agreement_options_loader()).where(Agreement.id == agreement_id, Agreement.is_deleted == False)
    res = await db.execute(stmt)
    agreement = res.scalar_one_or_none()

    if not agreement:
        raise NotFoundException(detail="Agreement record not found")

    # Validate file extension & content-type
    filename = file.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise CRMException(status_code=400, detail="Only PDF files (.pdf) are supported for agreement uploads")

    content = await file.read()
    file_size = len(content)
    if file_size > 20 * 1024 * 1024:  # 20 MB max
        raise CRMException(status_code=400, detail="File size exceeds maximum limit of 20 MB")

    # Save to disk
    unique_filename = f"{uuid.uuid4().hex}_{filename}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    with open(file_path, "wb") as f:
        f.write(content)

    checksum = hashlib.sha256(content).hexdigest()

    # Update metadata
    agreement.file_name = filename
    agreement.file_path = file_path
    agreement.file_size = file_size
    agreement.mime_type = "application/pdf"
    agreement.file_checksum = checksum
    agreement.updated_by_id = current_user.id

    if agreement.status == AgreementStatusEnum.DRAFT:
        agreement.status = AgreementStatusEnum.PENDING_SIGNATURE

    await log_audit_event(
        db=db,
        action="AGREEMENT_PDF_UPLOADED",
        entity_name="Agreement",
        entity_id=str(agreement.id),
        changes={
            "file_name": filename,
            "file_size": file_size,
            "checksum": checksum,
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(agreement)

    return ResponseEnvelope(
        success=True,
        message="Agreement PDF uploaded successfully",
        data=AgreementRead.model_validate(agreement)
    )


@router.get("/{agreement_id}", response_model=ResponseEnvelope[AgreementDetailRead])
async def get_agreement_by_id(
    agreement_id: UUID,
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Agreement).options(
        *agreement_options_loader(),
        selectinload(Agreement.versions)
    ).where(Agreement.id == agreement_id)

    if not include_deleted:
        stmt = stmt.where(Agreement.is_deleted == False)

    res = await db.execute(stmt)
    agreement = res.scalar_one_or_none()

    if not agreement:
        raise NotFoundException(detail="Agreement record not found")

    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id and agreement.client_id != user_client_id:
        raise ForbiddenException(detail="Access Denied: You do not have permission to view agreements belonging to another client.")

    return ResponseEnvelope(
        success=True,
        data=AgreementDetailRead.model_validate(agreement)
    )


@router.put("/{agreement_id}", response_model=ResponseEnvelope[AgreementRead])
@router.patch("/{agreement_id}", response_model=ResponseEnvelope[AgreementRead])
async def update_agreement(
    agreement_id: UUID,
    payload: AgreementUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Agreement).options(*agreement_options_loader()).where(Agreement.id == agreement_id, Agreement.is_deleted == False)
    res = await db.execute(stmt)
    agreement = res.scalar_one_or_none()

    if not agreement:
        raise NotFoundException(detail="Agreement record not found")

    changes = {}
    update_data = payload.model_dump(exclude_unset=True)

    for field, new_val in update_data.items():
        if hasattr(agreement, field):
            old_val = getattr(agreement, field)
            old_str = old_val.value if hasattr(old_val, "value") else (str(old_val) if isinstance(old_val, UUID) else old_val)
            new_str = new_val.value if hasattr(new_val, "value") else (str(new_val) if isinstance(new_val, UUID) else new_val)

            if old_str != new_str:
                changes[field] = {"old": old_str, "new": new_str}
                setattr(agreement, field, new_val)

    if changes:
        agreement.updated_by_id = current_user.id
        await log_audit_event(
            db=db,
            action="AGREEMENT_UPDATED",
            entity_name="Agreement",
            entity_id=str(agreement.id),
            changes=changes,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        await db.refresh(agreement)

    return ResponseEnvelope(
        success=True,
        message="Agreement updated successfully",
        data=AgreementRead.model_validate(agreement)
    )


@router.post("/{agreement_id}/sign", response_model=ResponseEnvelope[AgreementRead])
async def sign_agreement(
    agreement_id: UUID,
    payload: AgreementSignPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Agreement).options(*agreement_options_loader()).where(Agreement.id == agreement_id, Agreement.is_deleted == False)
    res = await db.execute(stmt)
    agreement = res.scalar_one_or_none()

    if not agreement:
        raise NotFoundException(detail="Agreement record not found")

    sign_time = payload.signed_at or datetime.now(timezone.utc)

    agreement.signed_by_name = payload.signed_by_name
    agreement.signed_by_email = payload.signed_by_email
    agreement.signed_at = sign_time
    agreement.status = AgreementStatusEnum.SIGNED
    agreement.consent_status = ConsentStatusEnum.CONSENT_GIVEN
    agreement.consent_given_at = sign_time
    agreement.updated_by_id = current_user.id

    await log_audit_event(
        db=db,
        action="AGREEMENT_SIGNED",
        entity_name="Agreement",
        entity_id=str(agreement.id),
        changes={
            "signed_by_name": payload.signed_by_name,
            "signed_by_email": payload.signed_by_email,
            "signed_at": sign_time.isoformat(),
            "status": AgreementStatusEnum.SIGNED.value,
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(agreement)

    return ResponseEnvelope(
        success=True,
        message="Agreement signature recorded successfully",
        data=AgreementRead.model_validate(agreement)
    )


@router.post("/{agreement_id}/consent", response_model=ResponseEnvelope[AgreementRead])
async def update_agreement_consent(
    agreement_id: UUID,
    payload: AgreementConsentPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Agreement).options(*agreement_options_loader()).where(Agreement.id == agreement_id, Agreement.is_deleted == False)
    res = await db.execute(stmt)
    agreement = res.scalar_one_or_none()

    if not agreement:
        raise NotFoundException(detail="Agreement record not found")

    old_consent = agreement.consent_status
    agreement.consent_status = payload.consent_status
    agreement.consent_notes = payload.consent_notes
    if payload.consent_status == ConsentStatusEnum.CONSENT_GIVEN:
        agreement.consent_given_at = datetime.now(timezone.utc)
    agreement.updated_by_id = current_user.id

    await log_audit_event(
        db=db,
        action="AGREEMENT_CONSENT_UPDATED",
        entity_name="Agreement",
        entity_id=str(agreement.id),
        changes={
            "consent_status": {"old": old_consent.value, "new": payload.consent_status.value},
            "notes": payload.consent_notes,
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(agreement)

    return ResponseEnvelope(
        success=True,
        message="Agreement consent status updated",
        data=AgreementRead.model_validate(agreement)
    )


@router.post("/{agreement_id}/create-version", response_model=ResponseEnvelope[AgreementRead], status_code=status.HTTP_201_CREATED)
async def create_agreement_version(
    agreement_id: UUID,
    payload: AgreementCreateVersionPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Agreement).where(Agreement.id == agreement_id, Agreement.is_deleted == False)
    res = await db.execute(stmt)
    parent_agr = res.scalar_one_or_none()

    if not parent_agr:
        raise NotFoundException(detail="Parent agreement record not found")

    next_version = parent_agr.version + 1
    new_agr_number = generate_agreement_number()

    new_version_agr = Agreement(
        title=payload.title or f"{parent_agr.title} (v{next_version})",
        agreement_number=new_agr_number,
        type=parent_agr.type,
        status=AgreementStatusEnum.DRAFT,
        consent_status=ConsentStatusEnum.PENDING,
        version=next_version,
        description=payload.description or parent_agr.description,
        effective_date=payload.effective_date or parent_agr.effective_date,
        expiration_date=payload.expiration_date or parent_agr.expiration_date,
        client_id=parent_agr.client_id,
        assigned_admin_id=parent_agr.assigned_admin_id,
        parent_agreement_id=parent_agr.id,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(new_version_agr)
    await db.commit()

    await log_audit_event(
        db=db,
        action="AGREEMENT_VERSION_CREATED",
        entity_name="Agreement",
        entity_id=str(new_version_agr.id),
        changes={
            "parent_id": str(parent_agr.id),
            "version": next_version,
            "agreement_number": new_agr_number,
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    stmt_created = select(Agreement).options(*agreement_options_loader()).where(Agreement.id == new_version_agr.id)
    res_created = await db.execute(stmt_created)
    created_agr = res_created.scalar_one()

    return ResponseEnvelope(
        success=True,
        message=f"Agreement version {next_version} created successfully",
        data=AgreementRead.model_validate(created_agr)
    )


@router.get("/{agreement_id}/download")
async def download_agreement_pdf(
    agreement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Agreement).where(Agreement.id == agreement_id, Agreement.is_deleted == False)
    res = await db.execute(stmt)
    agreement = res.scalar_one_or_none()

    if not agreement or not agreement.file_path:
        raise NotFoundException(detail="Agreement PDF file not found")

    if not os.path.exists(agreement.file_path):
        raise NotFoundException(detail="Stored PDF file does not exist on disk")

    filename = agreement.file_name or f"Agreement_{agreement.agreement_number}.pdf"
    return FileResponse(
        path=agreement.file_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{agreement_id}/preview")
async def preview_agreement_pdf(
    agreement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Agreement).where(Agreement.id == agreement_id, Agreement.is_deleted == False)
    res = await db.execute(stmt)
    agreement = res.scalar_one_or_none()

    if not agreement or not agreement.file_path:
        raise NotFoundException(detail="Agreement PDF file not found")

    if not os.path.exists(agreement.file_path):
        raise NotFoundException(detail="Stored PDF file does not exist on disk")

    filename = agreement.file_name or f"Agreement_{agreement.agreement_number}.pdf"
    return FileResponse(
        path=agreement.file_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )


@router.get("/{agreement_id}/versions", response_model=ResponseEnvelope[List[AgreementVersionRead]])
async def get_agreement_versions(
    agreement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Agreement).where(Agreement.id == agreement_id)
    res = await db.execute(stmt)
    target = res.scalar_one_or_none()

    if not target:
        raise NotFoundException(detail="Agreement record not found")

    # Find root parent if target is a child version
    root_id = target.parent_agreement_id or target.id

    stmt_versions = select(Agreement).where(
        or_(Agreement.id == root_id, Agreement.parent_agreement_id == root_id)
    ).order_by(asc(Agreement.version))

    res_versions = await db.execute(stmt_versions)
    versions = res_versions.scalars().all()

    return ResponseEnvelope(
        success=True,
        data=[AgreementVersionRead.model_validate(v) for v in versions]
    )


@router.get("/{agreement_id}/audit-logs", response_model=PaginatedResponse[AuditLogRead])
async def get_agreement_audit_logs(
    agreement_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt_target = select(Agreement).where(Agreement.id == agreement_id)
    res_target = await db.execute(stmt_target)
    if not res_target.scalar_one_or_none():
        raise NotFoundException(detail="Agreement record not found")

    query = select(AuditLog).options(
        selectinload(AuditLog.user).selectinload(User.role)
    ).where(
        AuditLog.entity_name == "Agreement",
        AuditLog.entity_id == str(agreement_id)
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


@router.delete("/{agreement_id}", response_model=ResponseEnvelope[dict])
async def delete_agreement(
    agreement_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES))
):
    stmt = select(Agreement).where(Agreement.id == agreement_id, Agreement.is_deleted == False)
    res = await db.execute(stmt)
    agreement = res.scalar_one_or_none()

    if not agreement:
        raise NotFoundException(detail="Agreement record not found")

    agreement.soft_delete(user_id=current_user.id)
    await log_audit_event(
        db=db,
        action="AGREEMENT_SOFT_DELETED",
        entity_name="Agreement",
        entity_id=str(agreement.id),
        changes={"is_deleted": {"old": False, "new": True}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Agreement soft-deleted successfully",
        data={"deleted": True, "id": str(agreement_id)}
    )


@router.post("/{agreement_id}/restore", response_model=ResponseEnvelope[AgreementRead])
async def restore_agreement(
    agreement_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Agreement).options(*agreement_options_loader()).where(Agreement.id == agreement_id, Agreement.is_deleted == True)
    res = await db.execute(stmt)
    agreement = res.scalar_one_or_none()

    if not agreement:
        raise NotFoundException(detail="Soft-deleted agreement record not found")

    agreement.restore()
    agreement.updated_by_id = current_user.id
    await log_audit_event(
        db=db,
        action="AGREEMENT_RESTORED",
        entity_name="Agreement",
        entity_id=str(agreement.id),
        changes={"is_deleted": {"old": True, "new": False}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(agreement)

    return ResponseEnvelope(
        success=True,
        message="Agreement record restored successfully",
        data=AgreementRead.model_validate(agreement)
    )
