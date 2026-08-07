from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.models.agreements import Agreement, AgreementStatusEnum, AgreementTypeEnum, ConsentStatusEnum
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class AgreementRepository(BaseRepository[Agreement]):
    def __init__(self):
        super().__init__(Agreement)

    def get_eager_options(self):
        return [
            selectinload(Agreement.client),
            selectinload(Agreement.assigned_admin).selectinload(User.role),
            selectinload(Agreement.versions),
        ]

    async def get_by_id_with_details(self, db: AsyncSession, agreement_id: UUID, include_deleted: bool = False) -> Optional[Agreement]:
        return await self.get_by_id(db, agreement_id, options=self.get_eager_options(), include_deleted=include_deleted)

    async def list_agreements_paginated(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        status_filter: Optional[AgreementStatusEnum] = None,
        agreement_type: Optional[AgreementTypeEnum] = None,
        consent_status: Optional[ConsentStatusEnum] = None,
        client_id: Optional[UUID] = None,
        include_deleted: bool = False,
        only_deleted: bool = False,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Tuple[List[Agreement], int]:
        query = select(Agreement).options(*self.get_eager_options())

        if only_deleted:
            query = query.where(Agreement.is_deleted == True)
        elif not include_deleted:
            query = query.where(Agreement.is_deleted == False)

        if search:
            search_fmt = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Agreement.title.ilike(search_fmt),
                    Agreement.agreement_number.ilike(search_fmt),
                    Agreement.description.ilike(search_fmt),
                )
            )

        if status_filter:
            query = query.where(Agreement.status == status_filter)

        if agreement_type:
            query = query.where(Agreement.agreement_type == agreement_type)

        if consent_status:
            query = query.where(Agreement.consent_status == consent_status)

        if client_id:
            query = query.where(Agreement.client_id == client_id)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        # Sort & Paginate
        sort_column = getattr(Agreement, sort_by, Agreement.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))

        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await db.execute(query)
        agreements = list(result.scalars().all())

        return agreements, total


agreement_repository = AgreementRepository()
