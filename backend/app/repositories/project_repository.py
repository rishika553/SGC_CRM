from datetime import datetime, timezone
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.models.projects import Project, ProjectStatusEnum, ProjectPriorityEnum
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    def __init__(self):
        super().__init__(Project)

    def get_eager_options(self):
        return [
            selectinload(Project.client),
            selectinload(Project.assigned_admin).selectinload(User.role),
        ]

    async def get_by_id_with_details(self, db: AsyncSession, project_id: UUID, include_deleted: bool = False) -> Optional[Project]:
        return await self.get_by_id(db, project_id, options=self.get_eager_options(), include_deleted=include_deleted)

    async def list_projects_paginated(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        status_filter: Optional[ProjectStatusEnum] = None,
        priority_filter: Optional[ProjectPriorityEnum] = None,
        client_id: Optional[UUID] = None,
        assigned_admin_id: Optional[UUID] = None,
        overdue_only: bool = False,
        include_deleted: bool = False,
        only_deleted: bool = False,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Tuple[List[Project], int]:
        query = select(Project).options(*self.get_eager_options())

        if only_deleted:
            query = query.where(Project.is_deleted == True)
        elif not include_deleted:
            query = query.where(Project.is_deleted == False)

        if search:
            search_fmt = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Project.name.ilike(search_fmt),
                    Project.project_code.ilike(search_fmt),
                    Project.description.ilike(search_fmt),
                    Project.notes.ilike(search_fmt),
                )
            )

        if status_filter:
            query = query.where(Project.status == status_filter)

        if priority_filter:
            query = query.where(Project.priority == priority_filter)

        if client_id:
            query = query.where(Project.client_id == client_id)

        if assigned_admin_id:
            query = query.where(Project.assigned_admin_id == assigned_admin_id)

        if overdue_only:
            now = datetime.now(timezone.utc)
            query = query.where(
                Project.deadline < now,
                Project.status.not_in([ProjectStatusEnum.COMPLETED, ProjectStatusEnum.CANCELLED])
            )

        # Count total
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
        projects = list(result.scalars().all())

        return projects, total


project_repository = ProjectRepository()
