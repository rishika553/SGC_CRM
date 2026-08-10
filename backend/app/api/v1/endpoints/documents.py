import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, UploadFile, File, Form, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.core.database import get_db
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException, CRMException
from app.api.deps import get_current_user, get_user_client_id, require_roles, ADMIN_ROLES, ALL_ROLES
from app.models.documents import Document, DocumentCategoryEnum
from app.models.clients import Client
from app.models.projects import Project
from app.models.audit import AuditLog
from app.models.role import UserRoleEnum
from app.models.user import User
from app.schemas.common import ResponseEnvelope, PaginatedResponse, PaginationMeta
from app.schemas.documents import (
    DocumentRead,
    DocumentDetailRead,
    DocumentCreate,
    DocumentUpdate,
    SecureUrlRead,
    DocumentVersionRead,
)
from app.schemas.audit import AuditLogRead
from app.services.audit_service import log_audit_event
from app.services.storage_service import upload_file_to_storage, generate_secure_signed_url

router = APIRouter()


def document_options_loader():
    return [
        selectinload(Document.client).selectinload(Client.assigned_admin).selectinload(User.role),
        selectinload(Document.client).selectinload(Client.account_manager).selectinload(User.role),
        selectinload(Document.client).selectinload(Client.contacts),
        selectinload(Document.project),
        selectinload(Document.uploaded_by).selectinload(User.role),
        selectinload(Document.versions),
    ]


@router.get("", response_model=PaginatedResponse[DocumentRead])
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by title, file name, or description"),
    category_filter: Optional[DocumentCategoryEnum] = Query(None, alias="category"),
    client_id: Optional[UUID] = Query(None),
    project_id: Optional[UUID] = Query(None),
    mime_type: Optional[str] = Query(None),
    include_deleted: bool = Query(False),
    only_deleted: bool = Query(False),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    base_query = select(Document)

    if only_deleted:
        base_query = base_query.where(Document.is_deleted == True)
    elif not include_deleted:
        base_query = base_query.where(Document.is_deleted == False)

    # Enforce backend-level client data isolation
    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id:
        base_query = base_query.where(Document.client_id == user_client_id)
    elif client_id:
        base_query = base_query.where(Document.client_id == client_id)

    if search:
        search_fmt = f"%{search.strip()}%"
        base_query = base_query.where(
            or_(
                Document.title.ilike(search_fmt),
                Document.file_name.ilike(search_fmt),
                Document.description.ilike(search_fmt),
            )
        )

    if category_filter:
        base_query = base_query.where(Document.category == category_filter)

    if project_id:
        base_query = base_query.where(Document.project_id == project_id)

    if mime_type:
        base_query = base_query.where(Document.mime_type.ilike(f"%{mime_type.strip()}%"))

    # Count using base query
    count_query = select(func.count()).select_from(base_query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Apply options, sort & paginate
    query = base_query.options(*document_options_loader())
    sort_column = getattr(Document, sort_by, Document.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    documents = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        success=True,
        data=[DocumentRead.model_validate(d) for d in documents],
        meta=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )
    )


@router.post("/upload", response_model=ResponseEnvelope[DocumentRead], status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    category: DocumentCategoryEnum = Form(DocumentCategoryEnum.OTHER),
    description: Optional[str] = Form(None),
    is_secured: bool = Form(True),
    client_id: Optional[UUID] = Form(None),
    project_id: Optional[UUID] = Form(None),
    parent_document_id: Optional[UUID] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES))
):
    if client_id:
        stmt_c = select(Client).where(Client.id == client_id, Client.is_deleted == False)
        res_c = await db.execute(stmt_c)
        if not res_c.scalar_one_or_none():
            raise NotFoundException(detail="Target client profile not found")

    if project_id:
        stmt_p = select(Project).where(Project.id == project_id, Project.is_deleted == False)
        res_p = await db.execute(stmt_p)
        if not res_p.scalar_one_or_none():
            raise NotFoundException(detail="Target project not found")

    stmt_cur = select(User.id).where(User.id == current_user.id, User.is_deleted == False)
    res_cur = await db.execute(stmt_cur)
    cur_user_exists = bool(res_cur.scalar_one_or_none())
    uploader_id = current_user.id if cur_user_exists else None

    try:
        content = await file.read()
        filename = file.filename or "document.bin"
        mime = file.content_type or "application/octet-stream"
        ext = os.path.splitext(filename)[1].lower()

        # Upload to storage service (Supabase or fallback local)
        storage_path, storage_type, file_size, checksum = await upload_file_to_storage(
            content=content,
            filename=filename,
            mime_type=mime
        )

        version = 1
        if parent_document_id:
            stmt_parent = select(Document).where(Document.id == parent_document_id, Document.is_deleted == False)
            res_parent = await db.execute(stmt_parent)
            parent_doc = res_parent.scalar_one_or_none()
            if parent_doc:
                version = parent_doc.version + 1

        public_url = generate_secure_signed_url(storage_path, storage_type)

        new_doc = Document(
            title=title,
            file_name=filename,
            storage_path=storage_path,
            storage_type=storage_type,
            public_url=public_url,
            file_size=file_size,
            mime_type=mime,
            file_extension=ext,
            file_checksum=checksum,
            category=category,
            version=version,
            description=description,
            is_secured=is_secured,
            client_id=client_id,
            project_id=project_id,
            uploaded_by_id=uploader_id,
            parent_document_id=parent_document_id,
            created_by_id=uploader_id,
            updated_by_id=uploader_id,
        )
        db.add(new_doc)
        await db.commit()

        if cur_user_exists:
            try:
                await log_audit_event(
                    db=db,
                    action="DOCUMENT_UPLOADED",
                    entity_name="Document",
                    entity_id=str(new_doc.id),
                    changes={
                        "title": new_doc.title,
                        "file_name": new_doc.file_name,
                        "category": new_doc.category.value,
                        "version": new_doc.version,
                        "storage_type": new_doc.storage_type,
                    },
                    user_id=current_user.id,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                )
                await db.commit()
            except Exception:
                pass

        stmt = select(Document).options(*document_options_loader()).where(Document.id == new_doc.id)
        res = await db.execute(stmt)
        created_doc = res.scalar_one()

        return ResponseEnvelope(
            success=True,
            message="Document uploaded successfully",
            data=DocumentRead.model_validate(created_doc)
        )
    except Exception as e:
        await db.rollback()
        print(f"[DOCUMENT_UPLOAD_ERROR] {e}")
        raise CRMException(status_code=400, detail=f"Failed to upload document: {str(e)}")


@router.get("/{document_id}", response_model=ResponseEnvelope[DocumentDetailRead])
async def get_document_by_id(
    document_id: UUID,
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Document).options(*document_options_loader()).where(Document.id == document_id)

    if not include_deleted:
        stmt = stmt.where(Document.is_deleted == False)

    res = await db.execute(stmt)
    document = res.scalar_one_or_none()

    if not document:
        raise NotFoundException(detail="Document record not found")

    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id and document.client_id != user_client_id:
        raise ForbiddenException(detail="Access Denied: You do not have permission to view documents belonging to another client.")

    detail = DocumentDetailRead.model_validate(document)
    detail.versions = [DocumentVersionRead.model_validate(v) for v in (document.versions or [])]
    detail.signed_preview_url = generate_secure_signed_url(document.storage_path, document.storage_type)
    detail.signed_download_url = f"/api/v1/documents/{document.id}/download"

    return ResponseEnvelope(
        success=True,
        data=detail
    )


@router.put("/{document_id}", response_model=ResponseEnvelope[DocumentRead])
@router.patch("/{document_id}", response_model=ResponseEnvelope[DocumentRead])
async def update_document(
    document_id: UUID,
    payload: DocumentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES))
):
    stmt = select(Document).options(*document_options_loader()).where(Document.id == document_id, Document.is_deleted == False)
    res = await db.execute(stmt)
    document = res.scalar_one_or_none()

    if not document:
        raise NotFoundException(detail="Document record not found")

    changes = {}
    update_data = payload.model_dump(exclude_unset=True)

    for field, new_val in update_data.items():
        if hasattr(document, field):
            old_val = getattr(document, field)
            old_str = old_val.value if hasattr(old_val, "value") else (str(old_val) if isinstance(old_val, UUID) else old_val)
            new_str = new_val.value if hasattr(new_val, "value") else (str(new_val) if isinstance(new_val, UUID) else new_val)

            if old_str != new_str:
                changes[field] = {"old": old_str, "new": new_str}
                setattr(document, field, new_val)

    if changes:
        document.updated_by_id = current_user.id
        await log_audit_event(
            db=db,
            action="DOCUMENT_UPDATED",
            entity_name="Document",
            entity_id=str(document.id),
            changes=changes,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        await db.refresh(document)

    return ResponseEnvelope(
        success=True,
        message="Document details updated successfully",
        data=DocumentRead.model_validate(document)
    )


@router.post("/{document_id}/create-version", response_model=ResponseEnvelope[DocumentRead], status_code=status.HTTP_201_CREATED)
async def create_document_version(
    document_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES))
):
    stmt = select(Document).where(Document.id == document_id, Document.is_deleted == False)
    res = await db.execute(stmt)
    parent_doc = res.scalar_one_or_none()

    if not parent_doc:
        raise NotFoundException(detail="Parent document record not found")

    content = await file.read()
    filename = file.filename or "document_v2.bin"
    mime = file.content_type or "application/octet-stream"

    storage_path, storage_type, file_size, checksum = await upload_file_to_storage(
        content=content,
        filename=filename,
        mime_type=mime
    )

    next_version = parent_doc.version + 1
    new_title = title or f"{parent_doc.title} (v{next_version})"
    public_url = generate_secure_signed_url(storage_path, storage_type)

    new_version_doc = Document(
        title=new_title,
        file_name=filename,
        storage_path=storage_path,
        storage_type=storage_type,
        public_url=public_url,
        file_size=file_size,
        mime_type=mime,
        file_extension=os.path.splitext(filename)[1].lower(),
        file_checksum=checksum,
        category=parent_doc.category,
        version=next_version,
        description=description or parent_doc.description,
        is_secured=parent_doc.is_secured,
        client_id=parent_doc.client_id,
        project_id=parent_doc.project_id,
        uploaded_by_id=current_user.id,
        parent_document_id=parent_doc.id,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(new_version_doc)
    await db.commit()

    await log_audit_event(
        db=db,
        action="DOCUMENT_VERSION_CREATED",
        entity_name="Document",
        entity_id=str(new_version_doc.id),
        changes={
            "parent_id": str(parent_doc.id),
            "version": next_version,
            "file_name": filename,
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    stmt_c = select(Document).options(*document_options_loader()).where(Document.id == new_version_doc.id)
    res_c = await db.execute(stmt_c)
    created_ver = res_c.scalar_one()

    return ResponseEnvelope(
        success=True,
        message=f"Document version {next_version} uploaded successfully",
        data=DocumentRead.model_validate(created_ver)
    )


@router.get("/{document_id}/preview")
async def preview_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Document).where(Document.id == document_id, Document.is_deleted == False)
    res = await db.execute(stmt)
    document = res.scalar_one_or_none()

    if not document:
        raise NotFoundException(detail="Document record not found")

    if document.storage_type == "supabase" and document.public_url:
        return RedirectResponse(url=document.public_url)

    if os.path.exists(document.storage_path):
        return FileResponse(
            path=document.storage_path,
            media_type=document.mime_type,
            headers={"Content-Disposition": f'inline; filename="{document.file_name}"'}
        )

    raise NotFoundException(detail="Stored document file does not exist on disk or storage")


@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Document).where(Document.id == document_id, Document.is_deleted == False)
    res = await db.execute(stmt)
    document = res.scalar_one_or_none()

    if not document:
        raise NotFoundException(detail="Document record not found")

    await log_audit_event(
        db=db,
        action="DOCUMENT_DOWNLOADED",
        entity_name="Document",
        entity_id=str(document.id),
        changes={"file_name": document.file_name},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    if document.storage_type == "supabase" and document.public_url:
        return RedirectResponse(url=document.public_url)

    if os.path.exists(document.storage_path):
        return FileResponse(
            path=document.storage_path,
            media_type=document.mime_type,
            headers={"Content-Disposition": f'attachment; filename="{document.file_name}"'}
        )

    raise NotFoundException(detail="Stored document file does not exist on disk or storage")


@router.get("/stream-file")
async def stream_local_file(
    path: str = Query(...)
):
    if os.path.exists(path):
        filename = os.path.basename(path)
        return FileResponse(path=path, headers={"Content-Disposition": f'inline; filename="{filename}"'})
    raise NotFoundException(detail="Local file not found")


@router.get("/{document_id}/versions", response_model=ResponseEnvelope[List[DocumentVersionRead]])
async def get_document_versions(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Document).where(Document.id == document_id)
    res = await db.execute(stmt)
    target = res.scalar_one_or_none()

    if not target:
        raise NotFoundException(detail="Document record not found")

    root_id = target.parent_document_id or target.id

    stmt_v = select(Document).where(
        or_(Document.id == root_id, Document.parent_document_id == root_id)
    ).order_by(asc(Document.version))

    res_v = await db.execute(stmt_v)
    versions = res_v.scalars().all()

    return ResponseEnvelope(
        success=True,
        data=[DocumentVersionRead.model_validate(v) for v in versions]
    )


@router.get("/{document_id}/audit-logs", response_model=PaginatedResponse[AuditLogRead])
async def get_document_audit_logs(
    document_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt_target = select(Document).where(Document.id == document_id)
    res_target = await db.execute(stmt_target)
    if not res_target.scalar_one_or_none():
        raise NotFoundException(detail="Document record not found")

    query = select(AuditLog).options(
        selectinload(AuditLog.user).selectinload(User.role)
    ).where(
        AuditLog.entity_name == "Document",
        AuditLog.entity_id == str(document_id)
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


@router.delete("/{document_id}", response_model=ResponseEnvelope[dict])
async def delete_document(
    document_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES))
):
    stmt = select(Document).where(Document.id == document_id, Document.is_deleted == False)
    res = await db.execute(stmt)
    document = res.scalar_one_or_none()

    if not document:
        raise NotFoundException(detail="Document record not found")

    document.soft_delete(user_id=current_user.id)
    await log_audit_event(
        db=db,
        action="DOCUMENT_SOFT_DELETED",
        entity_name="Document",
        entity_id=str(document.id),
        changes={"is_deleted": {"old": False, "new": True}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Document soft-deleted successfully",
        data={"deleted": True, "id": str(document_id)}
    )


@router.post("/{document_id}/restore", response_model=ResponseEnvelope[DocumentRead])
async def restore_document(
    document_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES))
):
    stmt = select(Document).options(*document_options_loader()).where(Document.id == document_id, Document.is_deleted == True)
    res = await db.execute(stmt)
    document = res.scalar_one_or_none()

    if not document:
        raise NotFoundException(detail="Soft-deleted document record not found")

    document.restore()
    document.updated_by_id = current_user.id
    await log_audit_event(
        db=db,
        action="DOCUMENT_RESTORED",
        entity_name="Document",
        entity_id=str(document.id),
        changes={"is_deleted": {"old": True, "new": False}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(document)

    return ResponseEnvelope(
        success=True,
        message="Document record restored successfully",
        data=DocumentRead.model_validate(document)
    )
