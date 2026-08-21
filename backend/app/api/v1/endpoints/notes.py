from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc

from app.core.database import get_db
from app.core.exceptions import NotFoundException, ForbiddenException
from app.api.deps import get_current_user, get_user_client_id, require_roles, ADMIN_ROLES, ALL_ROLES
from app.models.notes import Note
from app.models.clients import Client
from app.models.user import User
from app.schemas.common import ResponseEnvelope, PaginatedResponse, PaginationMeta
from app.schemas.notes import NoteCreate, NoteUpdate, NoteRead
from app.services.audit_service import log_audit_event

router = APIRouter()


def note_options_loader():
    return [
        selectinload(Note.client),
        selectinload(Note.project),
        selectinload(Note.meeting),
        selectinload(Note.created_by).selectinload(User.role),
    ]


@router.get("", response_model=PaginatedResponse[NoteRead])
async def list_notes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    client_id: Optional[UUID] = Query(None),
    project_id: Optional[UUID] = Query(None),
    meeting_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Note).options(*note_options_loader()).where(Note.is_deleted == False)

    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id:
        query = query.where(Note.client_id == user_client_id)
    elif client_id:
        query = query.where(Note.client_id == client_id)

    if project_id:
        query = query.where(Note.project_id == project_id)
    if meeting_id:
        query = query.where(Note.meeting_id == meeting_id)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.where(or_(Note.title.ilike(search_fmt), Note.content.ilike(search_fmt)))

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    query = query.order_by(desc(Note.created_at))
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    notes = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        success=True,
        data=[NoteRead.model_validate(n) for n in notes],
        meta=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        ),
    )


@router.post("", response_model=ResponseEnvelope[NoteRead], status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: NoteCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES)),
):
    if not payload.client_id and not payload.project_id and not payload.meeting_id:
        raise ForbiddenException(detail="A note must be linked to at least one client, project, or meeting")

    new_note = Note(
        title=payload.title,
        content=payload.content,
        client_id=payload.client_id,
        project_id=payload.project_id,
        meeting_id=payload.meeting_id,
        created_by_id=current_user.id,
    )
    db.add(new_note)
    await db.commit()

    await log_audit_event(
        db=db,
        action="NOTE_CREATED",
        entity_name="Note",
        entity_id=str(new_note.id),
        changes={"title": new_note.title},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    stmt = select(Note).options(*note_options_loader()).where(Note.id == new_note.id)
    res = await db.execute(stmt)
    created = res.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Note created successfully",
        data=NoteRead.model_validate(created),
    )


@router.put("/{note_id}", response_model=ResponseEnvelope[NoteRead])
async def update_note(
    note_id: UUID,
    payload: NoteUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES)),
):
    stmt = select(Note).where(Note.id == note_id, Note.is_deleted == False)
    res = await db.execute(stmt)
    note = res.scalar_one_or_none()
    if not note:
        raise NotFoundException(detail="Note not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(note, field, value)

    note.updated_by_id = current_user.id
    await db.commit()

    await log_audit_event(
        db=db,
        action="NOTE_UPDATED",
        entity_name="Note",
        entity_id=str(note.id),
        changes={k: str(v) for k, v in update_data.items()},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    stmt_reload = select(Note).options(*note_options_loader()).where(Note.id == note.id)
    res_reload = await db.execute(stmt_reload)
    updated = res_reload.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Note updated successfully",
        data=NoteRead.model_validate(updated),
    )


@router.delete("/{note_id}", response_model=ResponseEnvelope[dict])
async def delete_note(
    note_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES)),
):
    stmt = select(Note).where(Note.id == note_id, Note.is_deleted == False)
    res = await db.execute(stmt)
    note = res.scalar_one_or_none()
    if not note:
        raise NotFoundException(detail="Note not found")

    note.soft_delete(user_id=current_user.id)
    await log_audit_event(
        db=db,
        action="NOTE_SOFT_DELETED",
        entity_name="Note",
        entity_id=str(note.id),
        changes={"is_deleted": {"old": False, "new": True}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Note deleted successfully",
        data={"deleted": True, "id": str(note_id)},
    )
