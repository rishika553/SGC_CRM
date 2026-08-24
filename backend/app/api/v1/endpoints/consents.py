import hashlib
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException, CRMException
from app.api.deps import (
    get_current_user,
    require_roles,
    get_user_client_id,
    ADMIN_ROLES,
    SUPER_ADMIN_ROLES,
    CLIENT_ROLES,
)
from app.models.consents import Consent, ConsentRequestStatusEnum
from app.models.clients import Client
from app.models.user import User
from app.models.assignments import ConsentAssignment
from app.schemas.common import ResponseEnvelope, PaginatedResponse, build_paginated_response
from app.schemas.consents import ConsentRead, ConsentUpdate, ConsentResponsePayload
from app.repositories import consent_repository
from app.services.audit_service import log_audit_event
from app.services.assignment_service import sync_consent_assignments

router = APIRouter()

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "consents")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def consent_options_loader():
    return [
        selectinload(Consent.client).selectinload(Client.assigned_admin).selectinload(User.role),
        selectinload(Consent.client).selectinload(Client.assigned_admin).selectinload(User.organization),
        selectinload(Consent.client).selectinload(Client.account_manager).selectinload(User.role),
        selectinload(Consent.client).selectinload(Client.account_manager).selectinload(User.organization),
        selectinload(Consent.client).selectinload(Client.contacts),
        selectinload(Consent.responded_by).selectinload(User.role),
        selectinload(Consent.responded_by).selectinload(User.organization),
        selectinload(Consent.assignments).selectinload(ConsentAssignment.user).selectinload(User.role),
    ]


@router.get("", response_model=PaginatedResponse[ConsentRead])
async def list_consents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by title or description"),
    status_filter: Optional[ConsentRequestStatusEnum] = Query(None, alias="status"),
    client_id: Optional[UUID] = Query(None),
    include_deleted: bool = Query(False),
    only_deleted: bool = Query(False),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Enforce backend-level client data isolation for client accounts
    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id:
        client_id = user_client_id
    elif client_id:
        stmt_client = select(Client).where(Client.id == client_id, Client.is_deleted == False)
        res_client = await db.execute(stmt_client)
        if not res_client.scalar_one_or_none():
            raise NotFoundException(detail="Target client profile not found")

    consents, total = await consent_repository.list_consents_paginated(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status_filter,
        client_id=client_id,
        include_deleted=include_deleted,
        only_deleted=only_deleted,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return build_paginated_response(
        items=[ConsentRead.model_validate(c) for c in consents],
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("", response_model=ResponseEnvelope[ConsentRead], status_code=status.HTTP_201_CREATED)
async def create_consent(
    request: Request,
    client_id: UUID = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    title = title.strip()
    if not title:
        raise CRMException(status_code=400, detail="Consent request title is required")

    # Verify client exists
    stmt_client = select(Client).where(Client.id == client_id, Client.is_deleted == False)
    res_client = await db.execute(stmt_client)
    if not res_client.scalar_one_or_none():
        raise NotFoundException(detail="Target client profile not found")

    file_name = None
    file_path = None
    file_size = None
    mime_type = None
    file_checksum = None

    if file and file.filename:
        filename = file.filename
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise CRMException(status_code=400, detail="File size exceeds maximum limit of 20 MB")

        unique_filename = f"{uuid.uuid4().hex}_{os.path.basename(filename)}"
        saved_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(saved_path, "wb") as f:
            f.write(content)

        file_name = filename
        file_path = saved_path
        file_size = len(content)
        mime_type = file.content_type or "application/octet-stream"
        file_checksum = hashlib.sha256(content).hexdigest()

    new_consent = Consent(
        title=title,
        description=description,
        status=ConsentRequestStatusEnum.PENDING,
        file_name=file_name,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        file_checksum=file_checksum,
        client_id=client_id,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(new_consent)
    await db.commit()

    # Log audit event
    await log_audit_event(
        db=db,
        action="CONSENT_REQUESTED",
        entity_name="Consent",
        entity_id=str(new_consent.id),
        changes={
            "title": new_consent.title,
            "client_id": str(new_consent.client_id),
            "has_attachment": bool(new_consent.file_name),
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    # Load relationships
    stmt = select(Consent).options(*consent_options_loader()).where(Consent.id == new_consent.id)
    res = await db.execute(stmt)
    created_consent = res.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Consent request created successfully",
        data=ConsentRead.model_validate(created_consent)
    )


@router.get("/{consent_id}", response_model=ResponseEnvelope[ConsentRead])
async def get_consent_by_id(
    consent_id: UUID,
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Consent).options(*consent_options_loader()).where(Consent.id == consent_id)

    if not include_deleted:
        stmt = stmt.where(Consent.is_deleted == False)

    res = await db.execute(stmt)
    consent = res.scalar_one_or_none()

    if not consent:
        raise NotFoundException(detail="Consent request not found")

    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id and consent.client_id != user_client_id:
        raise ForbiddenException(detail="Access Denied: You do not have permission to view consent requests belonging to another client.")

    return ResponseEnvelope(
        success=True,
        data=ConsentRead.model_validate(consent)
    )


@router.put("/{consent_id}", response_model=ResponseEnvelope[ConsentRead])
@router.patch("/{consent_id}", response_model=ResponseEnvelope[ConsentRead])
async def update_consent(
    consent_id: UUID,
    payload: ConsentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Consent).options(*consent_options_loader()).where(Consent.id == consent_id, Consent.is_deleted == False)
    res = await db.execute(stmt)
    consent = res.scalar_one_or_none()

    if not consent:
        raise NotFoundException(detail="Consent request not found")

    changes = {}
    update_data = payload.model_dump(exclude_unset=True)
    assignee_ids = update_data.pop("assignee_ids", None)

    for field, new_val in update_data.items():
        if hasattr(consent, field):
            old_val = getattr(consent, field)
            old_str = old_val.value if hasattr(old_val, "value") else (str(old_val) if isinstance(old_val, UUID) else old_val)
            new_str = new_val.value if hasattr(new_val, "value") else (str(new_val) if isinstance(new_val, UUID) else new_val)

            if old_str != new_str:
                changes[field] = {"old": old_str, "new": new_str}
                setattr(consent, field, new_val)

    if changes:
        consent.updated_by_id = current_user.id

    await sync_consent_assignments(db, consent.id, assignee_ids, current_user.id)

    if changes:
        await log_audit_event(
            db=db,
            action="CONSENT_UPDATED",
            entity_name="Consent",
            entity_id=str(consent.id),
            changes=changes,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    await db.commit()

    stmt_reload = select(Consent).options(*consent_options_loader()).where(Consent.id == consent.id)
    res_reload = await db.execute(stmt_reload)
    reloaded = res_reload.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Consent request updated successfully",
        data=ConsentRead.model_validate(reloaded)
    )


@router.post("/{consent_id}/respond", response_model=ResponseEnvelope[ConsentRead])
async def respond_to_consent(
    consent_id: UUID,
    payload: ConsentResponsePayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(CLIENT_ROLES))
):
    stmt = select(Consent).options(*consent_options_loader()).where(Consent.id == consent_id, Consent.is_deleted == False)
    res = await db.execute(stmt)
    consent = res.scalar_one_or_none()

    if not consent:
        raise NotFoundException(detail="Consent request not found")

    # Enforce strict client data isolation
    user_client_id = await get_user_client_id(current_user, db)
    if not user_client_id:
        raise ForbiddenException(detail="Only client accounts can respond to consent requests")
    if consent.client_id != user_client_id:
        raise ForbiddenException(detail="Access Denied: You do not have permission to respond to this consent request.")

    # Prevent duplicate responses or modifying an already responded consent
    if consent.status != ConsentRequestStatusEnum.PENDING:
        raise ConflictException(
            detail="This consent request has already been responded to and cannot be changed."
        )

    response_time = datetime.now(timezone.utc)

    consent.status = payload.status
    consent.responded_at = response_time
    consent.responded_by_id = current_user.id
    consent.response_notes = payload.response_notes

    if payload.status == ConsentRequestStatusEnum.DENIED:
        consent.denial_reason = payload.denial_reason
    else:
        consent.denial_reason = None

    consent.updated_by_id = current_user.id

    await log_audit_event(
        db=db,
        action="CONSENT_RESPONDED",
        entity_name="Consent",
        entity_id=str(consent.id),
        changes={
            "status": {"old": ConsentRequestStatusEnum.PENDING.value, "new": payload.status.value},
            "denial_reason": payload.denial_reason,
            "responded_at": response_time.isoformat(),
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(consent)

    return ResponseEnvelope(
        success=True,
        message="Consent response recorded successfully",
        data=ConsentRead.model_validate(consent)
    )


@router.get("/{consent_id}/download")
async def download_consent_attachment(
    consent_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Consent).where(Consent.id == consent_id, Consent.is_deleted == False)
    res = await db.execute(stmt)
    consent = res.scalar_one_or_none()

    if not consent or not consent.file_path:
        raise NotFoundException(detail="Consent attachment file not found")

    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id and consent.client_id != user_client_id:
        raise ForbiddenException(detail="Access Denied: You do not have permission to download this attachment.")

    if not os.path.exists(consent.file_path):
        raise NotFoundException(detail="Stored attachment file does not exist on disk")

    await log_audit_event(
        db=db,
        action="CONSENT_ATTACHMENT_DOWNLOADED",
        entity_name="Consent",
        entity_id=str(consent.id),
        changes={"file_name": consent.file_name},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    filename = consent.file_name or f"ConsentAttachment_{consent_id}.bin"
    media_type = consent.mime_type or "application/octet-stream"
    return FileResponse(
        path=consent.file_path,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.delete("/{consent_id}", response_model=ResponseEnvelope[dict])
async def delete_consent(
    consent_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES))
):
    stmt = select(Consent).where(Consent.id == consent_id, Consent.is_deleted == False)
    res = await db.execute(stmt)
    consent = res.scalar_one_or_none()

    if not consent:
        raise NotFoundException(detail="Consent request not found")

    consent.soft_delete(user_id=current_user.id)
    await log_audit_event(
        db=db,
        action="CONSENT_SOFT_DELETED",
        entity_name="Consent",
        entity_id=str(consent.id),
        changes={"is_deleted": {"old": False, "new": True}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Consent request soft-deleted successfully",
        data={"deleted": True, "id": str(consent_id)}
    )
