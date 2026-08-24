import uuid
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.core.database import get_db
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException, CRMException
from app.api.deps import get_current_user, require_roles, ADMIN_ROLES, ALL_ROLES, get_user_client_id
from app.models.projects import Project, ProjectStatusEnum, ProjectPriorityEnum
from app.models.tasks import Task
from app.models.clients import Client, ClientStatusEnum
from app.models.audit import AuditLog
from app.models.role import UserRoleEnum
from app.models.user import User
from app.models.assignments import ProjectAssignment
from app.schemas.common import ResponseEnvelope, PaginatedResponse, PaginationMeta
from app.schemas.projects import (
    ProjectRead,
    ProjectDetailRead,
    ProjectCreate,
    ProjectUpdate,
    ProjectProgressUpdatePayload,
)
from app.schemas.audit import AuditLogRead
from app.services.audit_service import log_audit_event
from app.services.assignment_service import sync_project_assignments

router = APIRouter()


def project_options_loader():
    return [
        selectinload(Project.client).selectinload(Client.assigned_admin).selectinload(User.role),
        selectinload(Project.client).selectinload(Client.account_manager).selectinload(User.role),
        selectinload(Project.client).selectinload(Client.contacts),
        selectinload(Project.assigned_admin).selectinload(User.role),
        selectinload(Project.tasks.and_(Task.is_deleted == False)),
        selectinload(Project.assignments).selectinload(ProjectAssignment.user).selectinload(User.role),
    ]


def generate_project_code() -> str:
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:6].upper()
    return f"PRJ-{now_str}-{short_uuid}"


@router.get("", response_model=PaginatedResponse[ProjectRead])
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search across name, project code, description, or notes"),
    status_filter: Optional[ProjectStatusEnum] = Query(None, alias="status"),
    priority_filter: Optional[ProjectPriorityEnum] = Query(None, alias="priority"),
    client_id: Optional[UUID] = Query(None),
    assigned_admin_id: Optional[UUID] = Query(None),
    include_deleted: bool = Query(False),
    only_deleted: bool = Query(False),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Project).options(*project_options_loader())

    if only_deleted:
        query = query.where(Project.is_deleted == True)
    elif not include_deleted:
        query = query.where(Project.is_deleted == False)

    # Enforce backend-level client data isolation
    role_name_str = current_user.role.name.value if (hasattr(current_user, "role") and current_user.role and hasattr(current_user.role.name, "value")) else str(getattr(getattr(current_user, "role", None), "name", "") or "")
    is_client_user = role_name_str.lower() in ("client", "client_viewer")

    user_client_id = await get_user_client_id(current_user, db)
    if is_client_user:
        if user_client_id:
            query = query.where(Project.client_id == user_client_id)
        else:
            query = query.where(Project.id == None)
    elif client_id:
        query = query.where(Project.client_id == client_id)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.outerjoin(Client, Project.client_id == Client.id).where(
            or_(
                Project.name.ilike(search_fmt),
                Project.project_code.ilike(search_fmt),
                Project.description.ilike(search_fmt),
                Project.notes.ilike(search_fmt),
                Client.name.ilike(search_fmt),
            )
        )

    if status_filter:
        query = query.where(Project.status == status_filter)

    if priority_filter:
        query = query.where(Project.priority == priority_filter)

    if assigned_admin_id:
        query = query.where(Project.assigned_admin_id == assigned_admin_id)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Sort & Paginate
    sort_column = getattr(Project, sort_by, Project.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    projects = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        success=True,
        data=[ProjectRead.model_validate(p) for p in projects],
        meta=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )
    )


@router.post("", response_model=ResponseEnvelope[ProjectRead], status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_client_id = await get_user_client_id(current_user, db)

    role_name_str = current_user.role.name.value if (hasattr(current_user, "role") and current_user.role and hasattr(current_user.role, "name") and hasattr(current_user.role.name, "value")) else str(getattr(getattr(current_user, "role", None), "name", "") or "")

    if not user_client_id and role_name_str.lower() in ("client", "client_viewer"):
        res_c = await db.execute(select(Client).where(func.lower(Client.email) == current_user.email.lower(), Client.is_deleted == False))
        c_obj = res_c.scalar_one_or_none()
        if not c_obj:
            c_obj = Client(
                name=f"{current_user.first_name} {current_user.last_name} Company",
                primary_contact_name=f"{current_user.first_name} {current_user.last_name}",
                email=current_user.email,
                status=ClientStatusEnum.ACTIVE,
                created_by_id=current_user.id
            )
            db.add(c_obj)
            await db.commit()
        user_client_id = c_obj.id

    target_client_id = user_client_id or payload.client_id

    # Verify client exists
    stmt_client = select(Client).where(Client.id == target_client_id, Client.is_deleted == False)
    res_client = await db.execute(stmt_client)
    client_obj = res_client.scalar_one_or_none()
    if not client_obj:
        raise NotFoundException(detail="Target client profile not found")

    code = payload.project_code or generate_project_code()

    # Ensure uniqueness of project_code
    stmt_exists = select(Project).where(Project.project_code == code)
    res_exists = await db.execute(stmt_exists)
    if res_exists.scalar_one_or_none():
        raise ConflictException(detail=f"Project code '{code}' already exists")

    assigned_admin = payload.assigned_admin_id or client_obj.assigned_admin_id or current_user.id

    new_project = Project(
        name=payload.name,
        project_code=code,
        description=payload.description,
        notes=payload.notes,
        status=payload.status,
        priority=payload.priority,
        progress=payload.progress,
        budget=payload.budget,
        currency=payload.currency or "INR",
        start_date=payload.start_date,
        end_date=payload.end_date,
        deadline=payload.deadline,
        client_id=target_client_id,
        assigned_admin_id=assigned_admin,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    if payload.progress == 100:
        new_project.status = ProjectStatusEnum.COMPLETED
        new_project.actual_completion_date = datetime.now(timezone.utc)

    db.add(new_project)
    await db.flush()

    await sync_project_assignments(db, new_project.id, payload.assignee_ids, current_user.id)

    # Log audit event
    try:
        await log_audit_event(
            db=db,
            action="PROJECT_CREATED",
            entity_name="Project",
            entity_id=str(new_project.id),
            changes={
                "name": new_project.name,
                "project_code": new_project.project_code,
                "client_id": str(new_project.client_id),
                "status": new_project.status.value,
            },
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except Exception:
        pass

    await db.commit()

    stmt = select(Project).options(*project_options_loader()).where(Project.id == new_project.id)
    res = await db.execute(stmt)
    created_proj = res.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Project created successfully",
        data=ProjectRead.model_validate(created_proj)
    )


@router.get("/{project_id}", response_model=ResponseEnvelope[ProjectDetailRead])
async def get_project_by_id(
    project_id: UUID,
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Project).options(*project_options_loader()).where(Project.id == project_id)

    if not include_deleted:
        stmt = stmt.where(Project.is_deleted == False)

    res = await db.execute(stmt)
    project = res.scalar_one_or_none()

    if not project:
        raise NotFoundException(detail="Project record not found")

    role_name_str = current_user.role.name.value if (hasattr(current_user, "role") and current_user.role and hasattr(current_user.role.name, "value")) else str(getattr(getattr(current_user, "role", None), "name", "") or "")
    is_client_user = role_name_str.lower() in ("client", "client_viewer")

    user_client_id = await get_user_client_id(current_user, db)
    if is_client_user:
        if not user_client_id or project.client_id != user_client_id:
            raise ForbiddenException(detail="Access Denied: You do not have permission to view projects belonging to another client.")

    return ResponseEnvelope(
        success=True,
        data=ProjectDetailRead.model_validate(project)
    )


@router.put("/{project_id}", response_model=ResponseEnvelope[ProjectRead])
@router.patch("/{project_id}", response_model=ResponseEnvelope[ProjectRead])
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Project).options(*project_options_loader()).where(Project.id == project_id, Project.is_deleted == False)
    res = await db.execute(stmt)
    project = res.scalar_one_or_none()

    if not project:
        raise NotFoundException(detail="Project record not found")

    changes = {}
    update_data = payload.model_dump(exclude_unset=True)
    assignee_ids = update_data.pop("assignee_ids", None)

    for field, new_val in update_data.items():
        if hasattr(project, field):
            old_val = getattr(project, field)
            old_str = old_val.value if hasattr(old_val, "value") else (str(old_val) if isinstance(old_val, UUID) else old_val)
            new_str = new_val.value if hasattr(new_val, "value") else (str(new_val) if isinstance(new_val, UUID) else new_val)

            if old_str != new_str:
                changes[field] = {"old": old_str, "new": new_str}
                setattr(project, field, new_val)

    # Automatic completion tracking
    if project.progress == 100 and project.status != ProjectStatusEnum.COMPLETED:
        project.status = ProjectStatusEnum.COMPLETED
        project.actual_completion_date = datetime.now(timezone.utc)
        changes["status"] = {"old": project.status.value, "new": ProjectStatusEnum.COMPLETED.value}

    if changes:
        project.updated_by_id = current_user.id

    await sync_project_assignments(db, project.id, assignee_ids, current_user.id)

    if changes:
        await log_audit_event(
            db=db,
            action="PROJECT_UPDATED",
            entity_name="Project",
            entity_id=str(project.id),
            changes=changes,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    await db.commit()

    stmt_reload = select(Project).options(*project_options_loader()).where(Project.id == project.id)
    res_reload = await db.execute(stmt_reload)
    reloaded = res_reload.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Project details updated successfully",
        data=ProjectRead.model_validate(reloaded)
    )


@router.post("/{project_id}/progress", response_model=ResponseEnvelope[ProjectRead])
async def update_project_progress(
    project_id: UUID,
    payload: ProjectProgressUpdatePayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Project).options(*project_options_loader()).where(Project.id == project_id, Project.is_deleted == False)
    res = await db.execute(stmt)
    project = res.scalar_one_or_none()

    if not project:
        raise NotFoundException(detail="Project record not found")

    old_progress = project.progress
    old_status = project.status

    project.progress = payload.progress
    if payload.status:
        project.status = payload.status
    elif payload.progress == 100:
        project.status = ProjectStatusEnum.COMPLETED
        project.actual_completion_date = datetime.now(timezone.utc)
    elif payload.progress > 0 and project.status == ProjectStatusEnum.NOT_STARTED:
        project.status = ProjectStatusEnum.IN_PROGRESS

    if payload.notes:
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        note_entry = f"\n[{now_str} - Progress: {payload.progress}%]: {payload.notes}"
        project.notes = (project.notes or "") + note_entry

    project.updated_by_id = current_user.id

    await log_audit_event(
        db=db,
        action="PROJECT_PROGRESS_UPDATED",
        entity_name="Project",
        entity_id=str(project.id),
        changes={
            "progress": {"old": old_progress, "new": payload.progress},
            "status": {"old": old_status.value, "new": project.status.value},
            "notes": payload.notes,
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(project)

    return ResponseEnvelope(
        success=True,
        message="Project progress updated successfully",
        data=ProjectRead.model_validate(project)
    )


@router.get("/{project_id}/audit-logs", response_model=PaginatedResponse[AuditLogRead])
async def get_project_audit_logs(
    project_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt_target = select(Project).where(Project.id == project_id)
    res_target = await db.execute(stmt_target)
    if not res_target.scalar_one_or_none():
        raise NotFoundException(detail="Project record not found")

    query = select(AuditLog).options(
        selectinload(AuditLog.user).selectinload(User.role)
    ).where(
        AuditLog.entity_name == "Project",
        AuditLog.entity_id == str(project_id)
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


@router.delete("/{project_id}", response_model=ResponseEnvelope[dict])
async def delete_project(
    project_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRoleEnum.SUPER_ADMIN]))
):
    stmt = select(Project).where(Project.id == project_id, Project.is_deleted == False)
    res = await db.execute(stmt)
    project = res.scalar_one_or_none()

    if not project:
        raise NotFoundException(detail="Project record not found")

    project.soft_delete(user_id=current_user.id)
    await log_audit_event(
        db=db,
        action="PROJECT_SOFT_DELETED",
        entity_name="Project",
        entity_id=str(project.id),
        changes={"is_deleted": {"old": False, "new": True}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Project soft-deleted successfully",
        data={"deleted": True, "id": str(project_id)}
    )


@router.post("/{project_id}/restore", response_model=ResponseEnvelope[ProjectRead])
async def restore_project(
    project_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Project).options(*project_options_loader()).where(Project.id == project_id, Project.is_deleted == True)
    res = await db.execute(stmt)
    project = res.scalar_one_or_none()

    if not project:
        raise NotFoundException(detail="Soft-deleted project record not found")

    project.restore()
    project.updated_by_id = current_user.id
    await log_audit_event(
        db=db,
        action="PROJECT_RESTORED",
        entity_name="Project",
        entity_id=str(project.id),
        changes={"is_deleted": {"old": True, "new": False}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(project)

    return ResponseEnvelope(
        success=True,
        message="Project record restored successfully",
        data=ProjectRead.model_validate(project)
    )
