from typing import Optional, List, Tuple
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.models.audit import AuditLog
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class AuditRepository(BaseRepository[AuditLog]):
    def __init__(self):
        super().__init__(AuditLog)

    def get_eager_options(self):
        return [
            selectinload(AuditLog.user).selectinload(User.role),
        ]

    async def get_by_id_with_details(self, db: AsyncSession, log_id: UUID) -> Optional[AuditLog]:
        return await self.get_by_id(db, log_id, options=self.get_eager_options())

    async def list_audit_logs_paginated(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        action: Optional[str] = None,
        entity_name: Optional[str] = None,
        entity_id: Optional[str] = None,
        user_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Tuple[List[AuditLog], int]:
        query = select(AuditLog).options(*self.get_eager_options())

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

        # Count total
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
        audit_logs = list(result.scalars().all())

        return audit_logs, total


audit_repository = AuditRepository()
