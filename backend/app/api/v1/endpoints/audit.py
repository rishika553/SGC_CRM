import uuid
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, and_, desc, asc

from app.core.database import get_db
from app.core.exceptions import NotFoundException, ForbiddenException
from app.api.deps import get_current_user, require_roles, ADMIN_ROLES, ALL_ROLES
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.common import ResponseEnvelope, PaginatedResponse, PaginationMeta, build_paginated_response
from app.schemas.audit import AuditLogRead

router = APIRouter()


@router.get("", response_model=PaginatedResponse[AuditLogRead])
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search across action, entity name, entity ID, IP address, user agent, or user details"),
    action: Optional[str] = Query(None, description="Filter by exact action type e.g. LOGIN, AGREEMENT_CREATED, TASK_COMPLETED"),
    entity_name: Optional[str] = Query(None, description="Filter by entity name e.g. User, Document, Agreement, Project, Task, Invoice"),
    entity_id: Optional[str] = Query(None, description="Filter by target entity ID"),
    user_id: Optional[UUID] = Query(None, description="Filter by acting user ID"),
    start_date: Optional[datetime] = Query(None, description="Filter audit logs on or after start_date"),
    end_date: Optional[datetime] = Query(None, description="Filter audit logs on or before end_date"),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    """
    Searchable, paginated audit log listing with filters for actions, entities, users, IP addresses, date ranges, and full-text search.
    """
    query = select(AuditLog).options(
        selectinload(AuditLog.user).selectinload(User.role)
    )

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.outerjoin(AuditLog.user).where(
            or_(
                AuditLog.action.ilike(search_fmt),
                AuditLog.entity_name.ilike(search_fmt),
                AuditLog.entity_id.ilike(search_fmt),
                AuditLog.ip_address.ilike(search_fmt),
                AuditLog.user_agent.ilike(search_fmt),
                User.first_name.ilike(search_fmt),
                User.last_name.ilike(search_fmt),
                User.email.ilike(search_fmt),
            )
        )

    if action:
        query = query.where(AuditLog.action == action.strip())

    if entity_name:
        query = query.where(AuditLog.entity_name == entity_name.strip())

    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id.strip())

    if user_id:
        query = query.where(AuditLog.user_id == user_id)

    if start_date:
        query = query.where(AuditLog.created_at >= start_date)

    if end_date:
        query = query.where(AuditLog.created_at <= end_date)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Sort & Paginate
    sort_column = getattr(AuditLog, sort_by, AuditLog.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    audit_logs = result.scalars().all()

    return build_paginated_response(
        items=[AuditLogRead.model_validate(log) for log in audit_logs],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/metadata/actions", response_model=ResponseEnvelope[dict])
async def get_audit_actions_metadata(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    """
    Get distinct list of audit action types and entity categories for UI filtering dropdowns.
    """
    stmt_actions = select(AuditLog.action).distinct()
    res_actions = await db.execute(stmt_actions)
    actions = [a for a in res_actions.scalars().all() if a]

    stmt_entities = select(AuditLog.entity_name).distinct()
    res_entities = await db.execute(stmt_entities)
    entities = [e for e in res_entities.scalars().all() if e]

    return ResponseEnvelope(
        success=True,
        data={
            "actions": sorted(actions),
            "entity_names": sorted(entities),
        }
    )


@router.get("/{log_id}", response_model=ResponseEnvelope[AuditLogRead])
async def get_audit_log_by_id(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    """
    Get detailed audit log record by ID.
    """
    stmt = select(AuditLog).options(
        selectinload(AuditLog.user).selectinload(User.role)
    ).where(AuditLog.id == log_id)

    res = await db.execute(stmt)
    log = res.scalar_one_or_none()

    if not log:
        raise NotFoundException(detail="Audit log record not found")

    return ResponseEnvelope(
        success=True,
        data=AuditLogRead.model_validate(log)
    )
