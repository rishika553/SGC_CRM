import uuid
from datetime import datetime, timedelta, timezone
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
from app.models.tasks import Task, TaskComment, TaskStatusEnum, TaskPriorityEnum, RecurrenceTypeEnum
from app.models.projects import Project
from app.models.clients import Client
from app.models.audit import AuditLog
from app.models.role import UserRoleEnum
from app.models.user import User
from app.models.assignments import TaskAssignment
from app.schemas.common import ResponseEnvelope, PaginatedResponse, PaginationMeta
from app.schemas.tasks import (
    TaskRead,
    TaskDetailRead,
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdatePayload,
    TaskCommentCreate,
    TaskCommentRead,
)
from app.schemas.audit import AuditLogRead
from app.services.audit_service import log_audit_event
from app.services.assignment_service import sync_task_assignments


def _calculate_next_due_date(task: Task) -> Optional[datetime]:
    if not task.due_date:
        return None
    interval = task.recurrence_interval or 1
    if task.recurrence_type == RecurrenceTypeEnum.DAILY:
        return task.due_date + timedelta(days=interval)
    elif task.recurrence_type == RecurrenceTypeEnum.WEEKLY:
        return task.due_date + timedelta(weeks=interval)
    elif task.recurrence_type == RecurrenceTypeEnum.MONTHLY:
        return task.due_date + timedelta(days=interval * 30)
    elif task.recurrence_type == RecurrenceTypeEnum.CUSTOM:
        return task.due_date + timedelta(days=interval)
    return None


router = APIRouter()


def task_options_loader():
    return [
        selectinload(Task.assigned_to).selectinload(User.role),
        selectinload(Task.client).selectinload(Client.assigned_admin).selectinload(User.role),
        selectinload(Task.client).selectinload(Client.account_manager).selectinload(User.role),
        selectinload(Task.client).selectinload(Client.contacts),
        selectinload(Task.subtasks),
        selectinload(Task.assignments).selectinload(TaskAssignment.user).selectinload(User.role),
    ]


def generate_task_code() -> str:
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:6].upper()
    return f"TSK-{now_str}-{short_uuid}"


@router.get("", response_model=PaginatedResponse[TaskRead])
async def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search across title, task code, or description"),
    status_filter: Optional[TaskStatusEnum] = Query(None, alias="status"),
    priority_filter: Optional[TaskPriorityEnum] = Query(None, alias="priority"),
    assigned_to_id: Optional[UUID] = Query(None),
    project_id: Optional[UUID] = Query(None),
    client_id: Optional[UUID] = Query(None),
    parent_task_id: Optional[UUID] = Query(None),
    include_deleted: bool = Query(False),
    only_deleted: bool = Query(False),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    base_query = select(Task)

    if only_deleted:
        base_query = base_query.where(Task.is_deleted == True)
    elif not include_deleted:
        base_query = base_query.where(Task.is_deleted == False)

    # Enforce backend-level client data isolation
    role_name_str = current_user.role.name.value if (hasattr(current_user, "role") and current_user.role and hasattr(current_user.role.name, "value")) else str(getattr(getattr(current_user, "role", None), "name", "") or "")
    is_client_user = role_name_str.lower() in ("client", "client_viewer")

    user_client_id = await get_user_client_id(current_user, db)
    if is_client_user:
        if user_client_id:
            base_query = base_query.where(Task.client_id == user_client_id)
        else:
            base_query = base_query.where(Task.id == None)
    elif client_id:
        base_query = base_query.where(Task.client_id == client_id)

    if search:
        search_fmt = f"%{search.strip()}%"
        base_query = base_query.where(
            or_(
                Task.title.ilike(search_fmt),
                Task.task_code.ilike(search_fmt),
                Task.description.ilike(search_fmt),
            )
        )

    if status_filter:
        base_query = base_query.where(Task.status == status_filter)

    if priority_filter:
        base_query = base_query.where(Task.priority == priority_filter)

    if assigned_to_id:
        base_query = base_query.where(Task.assigned_to_id == assigned_to_id)

    if project_id:
        base_query = base_query.where(Task.project_id == project_id)

    if parent_task_id:
        base_query = base_query.where(Task.parent_task_id == parent_task_id)

    # Count using clean base query
    count_query = select(func.count()).select_from(base_query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    # Sort & Paginate with options
    query = base_query.options(*task_options_loader())
    sort_column = getattr(Task, sort_by, Task.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    tasks = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    task_reads = []
    for t in tasks:
        tr = TaskRead.model_validate(t)
        tr.subtasks_count = len(t.subtasks) if t.subtasks else 0
        task_reads.append(tr)

    return PaginatedResponse(
        success=True,
        data=task_reads,
        meta=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )
    )


@router.post("", response_model=ResponseEnvelope[TaskRead], status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES))
):
    try:
        if payload.parent_task_id:
            stmt_parent = select(Task).where(Task.id == payload.parent_task_id, Task.is_deleted == False)
            res_parent = await db.execute(stmt_parent)
            if not res_parent.scalar_one_or_none():
                raise NotFoundException(detail="Parent task not found")

        # Verify project_id exists if provided
        valid_project_id = None
        if payload.project_id:
            stmt_p = select(Project.id).where(Project.id == payload.project_id, Project.is_deleted == False)
            res_p = await db.execute(stmt_p)
            if res_p.scalar_one_or_none():
                valid_project_id = payload.project_id

        # Verify client_id exists if provided, or set for client users
        user_client_id = await get_user_client_id(current_user, db)
        valid_client_id = user_client_id or payload.client_id
        if valid_client_id:
            stmt_c = select(Client.id).where(Client.id == valid_client_id, Client.is_deleted == False)
            res_c = await db.execute(stmt_c)
            if not res_c.scalar_one_or_none():
                valid_client_id = None

        # Verify user foreign keys
        stmt_cur = select(User.id).where(User.id == current_user.id, User.is_deleted == False)
        res_cur = await db.execute(stmt_cur)
        cur_user_exists = bool(res_cur.scalar_one_or_none())

        assigned_user_id = None
        if payload.assigned_to_id:
            stmt_u = select(User.id).where(User.id == payload.assigned_to_id, User.is_deleted == False)
            res_u = await db.execute(stmt_u)
            if res_u.scalar_one_or_none():
                assigned_user_id = payload.assigned_to_id
        elif cur_user_exists:
            assigned_user_id = current_user.id

        creator_id = current_user.id if cur_user_exists else None

        code = payload.task_code or generate_task_code()

        new_task = Task(
            title=payload.title,
            task_code=code,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            due_date=payload.due_date,
            assigned_to_id=assigned_user_id,
            project_id=valid_project_id,
            client_id=valid_client_id,
            parent_task_id=payload.parent_task_id,
            recurrence_type=(payload.recurrence_type.value if payload.recurrence_type else "none"),
            recurrence_interval=payload.recurrence_interval,
            recurrence_end_date=payload.recurrence_end_date,
            created_by_id=creator_id,
            updated_by_id=creator_id,
        )
        if payload.status == TaskStatusEnum.COMPLETED:
            new_task.completed_at = datetime.now(timezone.utc)

        db.add(new_task)
        await db.flush()

        await sync_task_assignments(db, new_task.id, payload.assignee_ids, current_user.id)

        if cur_user_exists:
            try:
                await log_audit_event(
                    db=db,
                    action="TASK_CREATED",
                    entity_name="Task",
                    entity_id=str(new_task.id),
                    changes={
                        "title": new_task.title,
                        "task_code": new_task.task_code,
                        "assigned_to_id": str(new_task.assigned_to_id) if new_task.assigned_to_id else None,
                        "parent_task_id": str(new_task.parent_task_id) if new_task.parent_task_id else None,
                    },
                    user_id=current_user.id,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                )
            except Exception:
                pass

        await db.commit()

        stmt = select(Task).options(*task_options_loader()).where(Task.id == new_task.id)
        res = await db.execute(stmt)
        created_task = res.scalar_one()

        tr = TaskRead.model_validate(created_task)
        tr.subtasks_count = len(created_task.subtasks) if created_task.subtasks else 0

        return ResponseEnvelope(
            success=True,
            message="Task created successfully",
            data=tr
        )
    except CRMException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        print(f"[TASK_CREATE_ERROR] Failed to create task: {e}")
        raise CRMException(status_code=400, detail=f"Failed to create task: {str(e)}")


@router.get("/{task_id}", response_model=ResponseEnvelope[TaskDetailRead])
async def get_task_by_id(
    task_id: UUID,
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    loader = task_options_loader() + [
        selectinload(Task.comments).selectinload(TaskComment.user).selectinload(User.role)
    ]
    stmt = select(Task).options(*loader).where(Task.id == task_id)

    if not include_deleted:
        stmt = stmt.where(Task.is_deleted == False)

    res = await db.execute(stmt)
    task = res.scalar_one_or_none()

    if not task:
        raise NotFoundException(detail="Task record not found")

    user_client_id = await get_user_client_id(current_user, db)
    if user_client_id and task.client_id != user_client_id:
        raise ForbiddenException(detail="Access Denied: You do not have permission to view tasks belonging to another client.")

    subtask_reads = [TaskRead.model_validate(st) for st in (task.subtasks or []) if not st.is_deleted]
    comment_reads = [TaskCommentRead.model_validate(c) for c in (task.comments or []) if not c.is_deleted]

    detail = TaskDetailRead.model_validate(task)
    detail.subtasks = subtask_reads
    detail.subtasks_count = len(subtask_reads)
    detail.comments = comment_reads

    return ResponseEnvelope(
        success=True,
        data=detail
    )


@router.put("/{task_id}", response_model=ResponseEnvelope[TaskRead])
@router.patch("/{task_id}", response_model=ResponseEnvelope[TaskRead])
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES))
):
    stmt = select(Task).options(*task_options_loader()).where(Task.id == task_id, Task.is_deleted == False)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()

    if not task:
        raise NotFoundException(detail="Task record not found")

    changes = {}
    update_data = payload.model_dump(exclude_unset=True)
    assignee_ids = update_data.pop("assignee_ids", None)

    for field, new_val in update_data.items():
        if hasattr(task, field):
            old_val = getattr(task, field)
            old_str = old_val.value if hasattr(old_val, "value") else (str(old_val) if isinstance(old_val, UUID) else old_val)
            new_str = new_val.value if hasattr(new_val, "value") else (str(new_val) if isinstance(new_val, UUID) else new_val)

            if old_str != new_str:
                changes[field] = {"old": old_str, "new": new_str}
                setattr(task, field, new_val)

    if task.status == TaskStatusEnum.COMPLETED and not task.completed_at:
        task.completed_at = datetime.now(timezone.utc)

    if changes:
        task.updated_by_id = current_user.id

    await sync_task_assignments(db, task.id, assignee_ids, current_user.id)

    if changes:
        await log_audit_event(
            db=db,
            action="TASK_UPDATED",
            entity_name="Task",
            entity_id=str(task.id),
            changes=changes,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    await db.commit()

    stmt_reload = select(Task).options(*task_options_loader()).where(Task.id == task.id)
    res_reload = await db.execute(stmt_reload)
    reloaded = res_reload.scalar_one()

    tr = TaskRead.model_validate(reloaded)
    tr.subtasks_count = len(reloaded.subtasks) if reloaded.subtasks else 0

    return ResponseEnvelope(
        success=True,
        message="Task updated successfully",
        data=tr
    )


@router.post("/{task_id}/complete", response_model=ResponseEnvelope[TaskRead])
async def toggle_task_completion(
    task_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES))
):
    stmt = select(Task).options(*task_options_loader()).where(Task.id == task_id, Task.is_deleted == False)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()

    if not task:
        raise NotFoundException(detail="Task record not found")

    old_status = task.status
    if task.status == TaskStatusEnum.COMPLETED:
        task.status = TaskStatusEnum.TODO
        task.completed_at = None
        action_name = "TASK_REOPENED"
        msg = "Task reopened"
    else:
        task.status = TaskStatusEnum.COMPLETED
        task.completed_at = datetime.now(timezone.utc)
        action_name = "TASK_COMPLETED"
        msg = "Task marked as completed"

    task.updated_by_id = current_user.id
    await log_audit_event(
        db=db,
        action=action_name,
        entity_name="Task",
        entity_id=str(task.id),
        changes={"status": {"old": old_status.value, "new": task.status.value}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    if task.status == TaskStatusEnum.COMPLETED and task.recurrence_type and task.recurrence_type != RecurrenceTypeEnum.NONE:
        next_due_date = _calculate_next_due_date(task)
        if next_due_date:
            if task.recurrence_end_date and next_due_date > task.recurrence_end_date:
                pass
            else:
                parent_id = task.recurrence_parent_id or task.id
                new_code = generate_task_code()
                new_task = Task(
                    title=task.title,
                    task_code=new_code,
                    description=task.description,
                    status=TaskStatusEnum.TODO,
                    priority=task.priority,
                    due_date=next_due_date,
                    assigned_to_id=task.assigned_to_id,
                    project_id=task.project_id,
                    client_id=task.client_id,
                    parent_task_id=task.parent_task_id,
                    recurrence_type=task.recurrence_type,
                    recurrence_interval=task.recurrence_interval,
                    recurrence_end_date=task.recurrence_end_date,
                    recurrence_parent_id=parent_id,
                    created_by_id=task.created_by_id,
                    updated_by_id=current_user.id,
                )
                db.add(new_task)

    await db.commit()
    await db.refresh(task)

    tr = TaskRead.model_validate(task)
    tr.subtasks_count = len(task.subtasks) if task.subtasks else 0

    return ResponseEnvelope(
        success=True,
        message=msg,
        data=tr
    )


@router.post("/{task_id}/status", response_model=ResponseEnvelope[TaskRead])
async def update_task_status(
    task_id: UUID,
    payload: TaskStatusUpdatePayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES))
):
    stmt = select(Task).options(*task_options_loader()).where(Task.id == task_id, Task.is_deleted == False)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()

    if not task:
        raise NotFoundException(detail="Task record not found")

    old_status = task.status
    task.status = payload.status
    if payload.status == TaskStatusEnum.COMPLETED:
        task.completed_at = datetime.now(timezone.utc)

    if payload.comment:
        new_comment = TaskComment(
            task_id=task.id,
            user_id=current_user.id,
            content=f"Status changed to {payload.status.value.upper()}: {payload.comment}",
            created_by_id=current_user.id,
        )
        db.add(new_comment)

    task.updated_by_id = current_user.id
    await log_audit_event(
        db=db,
        action="TASK_STATUS_CHANGED",
        entity_name="Task",
        entity_id=str(task.id),
        changes={
            "status": {"old": old_status.value, "new": payload.status.value},
            "comment": payload.comment,
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    if payload.status == TaskStatusEnum.COMPLETED and task.recurrence_type and task.recurrence_type != RecurrenceTypeEnum.NONE:
        next_due_date = _calculate_next_due_date(task)
        if next_due_date:
            if not (task.recurrence_end_date and next_due_date > task.recurrence_end_date):
                parent_id = task.recurrence_parent_id or task.id
                new_code = generate_task_code()
                new_task = Task(
                    title=task.title,
                    task_code=new_code,
                    description=task.description,
                    status=TaskStatusEnum.TODO,
                    priority=task.priority,
                    due_date=next_due_date,
                    assigned_to_id=task.assigned_to_id,
                    project_id=task.project_id,
                    client_id=task.client_id,
                    parent_task_id=task.parent_task_id,
                    recurrence_type=task.recurrence_type,
                    recurrence_interval=task.recurrence_interval,
                    recurrence_end_date=task.recurrence_end_date,
                    recurrence_parent_id=parent_id,
                    created_by_id=task.created_by_id,
                    updated_by_id=current_user.id,
                )
                db.add(new_task)

    await db.commit()
    await db.refresh(task)

    tr = TaskRead.model_validate(task)
    tr.subtasks_count = len(task.subtasks) if task.subtasks else 0

    return ResponseEnvelope(
        success=True,
        message=f"Task status changed to {payload.status.value}",
        data=tr
    )


@router.post("/{task_id}/comments", response_model=ResponseEnvelope[TaskCommentRead], status_code=status.HTTP_201_CREATED)
async def add_task_comment(
    task_id: UUID,
    payload: TaskCommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt_task = select(Task).where(Task.id == task_id, Task.is_deleted == False)
    res_task = await db.execute(stmt_task)
    if not res_task.scalar_one_or_none():
        raise NotFoundException(detail="Task record not found")

    new_comment = TaskComment(
        task_id=task_id,
        user_id=current_user.id,
        content=payload.content,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(new_comment)
    await db.commit()

    await log_audit_event(
        db=db,
        action="TASK_COMMENT_ADDED",
        entity_name="Task",
        entity_id=str(task_id),
        changes={"comment_id": str(new_comment.id), "content": payload.content},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    stmt_c = select(TaskComment).options(selectinload(TaskComment.user).selectinload(User.role)).where(TaskComment.id == new_comment.id)
    res_c = await db.execute(stmt_c)
    comment_created = res_c.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Task comment added",
        data=TaskCommentRead.model_validate(comment_created)
    )


@router.get("/{task_id}/comments", response_model=ResponseEnvelope[List[TaskCommentRead]])
async def list_task_comments(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt_task = select(Task).where(Task.id == task_id, Task.is_deleted == False)
    res_task = await db.execute(stmt_task)
    if not res_task.scalar_one_or_none():
        raise NotFoundException(detail="Task record not found")

    stmt_comments = select(TaskComment).options(
        selectinload(TaskComment.user).selectinload(User.role)
    ).where(TaskComment.task_id == task_id, TaskComment.is_deleted == False).order_by(asc(TaskComment.created_at))

    res_comments = await db.execute(stmt_comments)
    comments = res_comments.scalars().all()

    return ResponseEnvelope(
        success=True,
        data=[TaskCommentRead.model_validate(c) for c in comments]
    )


@router.delete("/{task_id}/comments/{comment_id}", response_model=ResponseEnvelope[dict])
async def delete_task_comment(
    task_id: UUID,
    comment_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(TaskComment).where(TaskComment.id == comment_id, TaskComment.task_id == task_id, TaskComment.is_deleted == False)
    res = await db.execute(stmt)
    comment = res.scalar_one_or_none()

    if not comment:
        raise NotFoundException(detail="Task comment not found")

    if comment.user_id != current_user.id and current_user.role.name not in (UserRoleEnum.SUPER_ADMIN,):
        raise ForbiddenException(detail="You do not have permission to delete this comment")

    comment.soft_delete(user_id=current_user.id)
    await log_audit_event(
        db=db,
        action="TASK_COMMENT_DELETED",
        entity_name="Task",
        entity_id=str(task_id),
        changes={"deleted_comment_id": str(comment_id)},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Task comment deleted",
        data={"deleted": True, "comment_id": str(comment_id)}
    )


@router.get("/{task_id}/subtasks", response_model=ResponseEnvelope[List[TaskRead]])
async def list_subtasks(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt_task = select(Task).where(Task.id == task_id, Task.is_deleted == False)
    res_task = await db.execute(stmt_task)
    if not res_task.scalar_one_or_none():
        raise NotFoundException(detail="Task record not found")

    stmt_subtasks = select(Task).options(*task_options_loader()).where(
        Task.parent_task_id == task_id, Task.is_deleted == False
    ).order_by(asc(Task.created_at))

    res_subtasks = await db.execute(stmt_subtasks)
    subtasks = res_subtasks.scalars().all()

    return ResponseEnvelope(
        success=True,
        data=[TaskRead.model_validate(st) for st in subtasks]
    )


@router.get("/{task_id}/history", response_model=PaginatedResponse[AuditLogRead])
async def get_task_history(
    task_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt_target = select(Task).where(Task.id == task_id)
    res_target = await db.execute(stmt_target)
    if not res_target.scalar_one_or_none():
        raise NotFoundException(detail="Task record not found")

    base_query = select(AuditLog).where(
        AuditLog.entity_name == "Task",
        AuditLog.entity_id == str(task_id)
    )

    count_query = select(func.count()).select_from(base_query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    query = base_query.options(
        selectinload(AuditLog.user).selectinload(User.role)
    )
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


@router.delete("/{task_id}", response_model=ResponseEnvelope[dict])
async def delete_task(
    task_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES))
):
    stmt = select(Task).where(Task.id == task_id, Task.is_deleted == False)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()

    if not task:
        raise NotFoundException(detail="Task record not found")

    task.soft_delete(user_id=current_user.id)
    await log_audit_event(
        db=db,
        action="TASK_SOFT_DELETED",
        entity_name="Task",
        entity_id=str(task.id),
        changes={"is_deleted": {"old": False, "new": True}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Task soft-deleted successfully",
        data={"deleted": True, "id": str(task_id)}
    )


@router.post("/{task_id}/restore", response_model=ResponseEnvelope[TaskRead])
async def restore_task(
    task_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ALL_ROLES))
):
    stmt = select(Task).options(*task_options_loader()).where(Task.id == task_id, Task.is_deleted == True)
    res = await db.execute(stmt)
    task = res.scalar_one_or_none()

    if not task:
        raise NotFoundException(detail="Soft-deleted task record not found")

    task.restore()
    task.updated_by_id = current_user.id
    await log_audit_event(
        db=db,
        action="TASK_RESTORED",
        entity_name="Task",
        entity_id=str(task.id),
        changes={"is_deleted": {"old": True, "new": False}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(task)

    tr = TaskRead.model_validate(task)
    tr.subtasks_count = len(task.subtasks) if task.subtasks else 0

    return ResponseEnvelope(
        success=True,
        message="Task record restored successfully",
        data=tr
    )
