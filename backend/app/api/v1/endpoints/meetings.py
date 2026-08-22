from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.core.database import get_db
from app.core.exceptions import NotFoundException, ForbiddenException
from app.api.deps import get_current_user, get_user_client_id, require_roles, ADMIN_ROLES, CLIENT_ROLES, ALL_ROLES
from app.models.meetings import Meeting, MeetingStatusEnum
from app.models.clients import Client
from app.models.projects import Project
from app.models.user import User
from app.schemas.common import ResponseEnvelope, PaginatedResponse, PaginationMeta
from app.schemas.meetings import MeetingCreate, MeetingUpdate, MeetingRead
from app.services.audit_service import log_audit_event

router = APIRouter()


def meeting_options_loader():
    return [
        selectinload(Meeting.client).selectinload(Client.assigned_admin).selectinload(User.role),
        selectinload(Meeting.client).selectinload(Client.account_manager).selectinload(User.role),
        selectinload(Meeting.client).selectinload(Client.contacts),
        selectinload(Meeting.project).selectinload(Project.client).selectinload(Client.assigned_admin).selectinload(User.role),
        selectinload(Meeting.project).selectinload(Project.client).selectinload(Client.account_manager).selectinload(User.role),
        selectinload(Meeting.project).selectinload(Project.client).selectinload(Client.contacts),
        selectinload(Meeting.project).selectinload(Project.assigned_admin).selectinload(User.role),
        selectinload(Meeting.created_by).selectinload(User.role),
    ]


@router.get("", response_model=PaginatedResponse[MeetingRead])
async def list_meetings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None),
    status_filter: Optional[MeetingStatusEnum] = Query(None, alias="status"),
    client_id: Optional[UUID] = Query(None),
    project_id: Optional[UUID] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Meeting).options(*meeting_options_loader())

    if include_deleted:
        query = query.where(Meeting.is_deleted == True)
    else:
        query = query.outerjoin(Client, Meeting.client_id == Client.id).where(
            Meeting.is_deleted == False
        )

    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id:
        query = query.where(Meeting.client_id == user_client_id)
    elif client_id:
        query = query.where(Meeting.client_id == client_id)

    if project_id:
        query = query.where(Meeting.project_id == project_id)

    if status_filter:
        query = query.where(Meeting.status == status_filter)

    if start_date:
        query = query.where(Meeting.start_time >= start_date)
    if end_date:
        query = query.where(Meeting.start_time <= end_date)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.where(
            or_(
                Meeting.title.ilike(search_fmt),
                Meeting.description.ilike(search_fmt),
                Client.name.ilike(search_fmt),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    query = query.order_by(asc(Meeting.start_time))
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    meetings = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        success=True,
        data=[MeetingRead.model_validate(m) for m in meetings],
        meta=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        ),
    )


@router.get("/{meeting_id}", response_model=ResponseEnvelope[MeetingRead])
async def get_meeting(
    meeting_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Meeting).options(*meeting_options_loader()).where(
        Meeting.id == meeting_id, Meeting.is_deleted == False
    )
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()
    if not meeting:
        raise NotFoundException(detail="Meeting not found")

    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id and meeting.client_id != user_client_id:
        raise ForbiddenException(detail="Access denied to this meeting")

    return ResponseEnvelope(success=True, data=MeetingRead.model_validate(meeting))


@router.post("", response_model=ResponseEnvelope[MeetingRead], status_code=status.HTTP_201_CREATED)
async def create_meeting(
    payload: MeetingCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES)),
):
    stmt_client = select(Client).where(Client.id == payload.client_id, Client.is_deleted == False)
    res_client = await db.execute(stmt_client)
    if not res_client.scalar_one_or_none():
        raise NotFoundException(detail="Target client not found")

    new_meeting = Meeting(
        title=payload.title,
        description=payload.description,
        location=payload.location,
        meeting_type=payload.meeting_type,
        status=payload.status,
        start_time=payload.start_time,
        end_time=payload.end_time,
        timezone=payload.timezone,
        client_id=payload.client_id,
        project_id=payload.project_id,
        created_by_id=current_user.id,
    )
    db.add(new_meeting)
    await db.commit()

    await log_audit_event(
        db=db,
        action="MEETING_CREATED",
        entity_name="Meeting",
        entity_id=str(new_meeting.id),
        changes={"title": new_meeting.title, "client_id": str(new_meeting.client_id)},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    stmt = select(Meeting).options(*meeting_options_loader()).where(Meeting.id == new_meeting.id)
    res = await db.execute(stmt)
    created = res.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Meeting created successfully",
        data=MeetingRead.model_validate(created),
    )


@router.put("/{meeting_id}", response_model=ResponseEnvelope[MeetingRead])
async def update_meeting(
    meeting_id: UUID,
    payload: MeetingUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES)),
):
    stmt = select(Meeting).where(Meeting.id == meeting_id, Meeting.is_deleted == False)
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()
    if not meeting:
        raise NotFoundException(detail="Meeting not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(meeting, field, value)

    meeting.updated_by_id = current_user.id
    await db.commit()

    await log_audit_event(
        db=db,
        action="MEETING_UPDATED",
        entity_name="Meeting",
        entity_id=str(meeting.id),
        changes={k: str(v) for k, v in update_data.items()},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    stmt_reload = select(Meeting).options(*meeting_options_loader()).where(Meeting.id == meeting.id)
    res_reload = await db.execute(stmt_reload)
    updated = res_reload.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Meeting updated successfully",
        data=MeetingRead.model_validate(updated),
    )


@router.delete("/{meeting_id}", response_model=ResponseEnvelope[dict])
async def delete_meeting(
    meeting_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES)),
):
    stmt = select(Meeting).where(Meeting.id == meeting_id, Meeting.is_deleted == False)
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()
    if not meeting:
        raise NotFoundException(detail="Meeting not found")

    meeting.soft_delete(user_id=current_user.id)
    await log_audit_event(
        db=db,
        action="MEETING_SOFT_DELETED",
        entity_name="Meeting",
        entity_id=str(meeting.id),
        changes={"is_deleted": {"old": False, "new": True}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Meeting deleted successfully",
        data={"deleted": True, "id": str(meeting_id)},
    )
