from datetime import datetime, timezone
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.models.tasks import Task, TaskComment, TaskStatusEnum, TaskPriorityEnum
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class TaskRepository(BaseRepository[Task]):
    def __init__(self):
        super().__init__(Task)

    def get_eager_options(self):
        return [
            selectinload(Task.assigned_to).selectinload(User.role),
            selectinload(Task.client),
            selectinload(Task.project),
            selectinload(Task.subtasks),
        ]

    async def get_by_id_with_details(self, db: AsyncSession, task_id: UUID, include_deleted: bool = False) -> Optional[Task]:
        return await self.get_by_id(db, task_id, options=self.get_eager_options(), include_deleted=include_deleted)

    async def list_tasks_paginated(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        status_filter: Optional[TaskStatusEnum] = None,
        priority_filter: Optional[TaskPriorityEnum] = None,
        assigned_user_id: Optional[UUID] = None,
        client_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        parent_task_id: Optional[UUID] = None,
        only_root_tasks: bool = False,
        overdue_only: bool = False,
        include_deleted: bool = False,
        only_deleted: bool = False,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Tuple[List[Task], int]:
        query = select(Task).options(*self.get_eager_options())

        if only_deleted:
            query = query.where(Task.is_deleted == True)
        elif not include_deleted:
            query = query.where(Task.is_deleted == False)

        if search:
            search_fmt = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Task.title.ilike(search_fmt),
                    Task.description.ilike(search_fmt),
                )
            )

        if status_filter:
            query = query.where(Task.status == status_filter)

        if priority_filter:
            query = query.where(Task.priority == priority_filter)

        if assigned_user_id:
            query = query.where(Task.assigned_to_id == assigned_user_id)

        if client_id:
            query = query.where(Task.client_id == client_id)

        if project_id:
            query = query.where(Task.project_id == project_id)

        if parent_task_id:
            query = query.where(Task.parent_task_id == parent_task_id)
        elif only_root_tasks:
            query = query.where(Task.parent_task_id.is_(None))

        if overdue_only:
            now = datetime.now(timezone.utc)
            query = query.where(
                Task.due_date < now,
                Task.status.not_in([TaskStatusEnum.COMPLETED, TaskStatusEnum.CANCELLED])
            )

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        # Sort & Paginate
        sort_column = getattr(Task, sort_by, Task.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))

        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await db.execute(query)
        tasks = list(result.scalars().all())

        return tasks, total


task_repository = TaskRepository()
