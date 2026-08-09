from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.models.consents import Consent, ConsentRequestStatusEnum
from app.models.clients import Client
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class ConsentRepository(BaseRepository[Consent]):
    def __init__(self):
        super().__init__(Consent)

    def get_eager_options(self):
        return [
            selectinload(Consent.client).selectinload(Client.assigned_admin).selectinload(User.role),
            selectinload(Consent.client).selectinload(Client.assigned_admin).selectinload(User.organization),
            selectinload(Consent.client).selectinload(Client.account_manager).selectinload(User.role),
            selectinload(Consent.client).selectinload(Client.account_manager).selectinload(User.organization),
            selectinload(Consent.client).selectinload(Client.contacts),
            selectinload(Consent.responded_by).selectinload(User.role),
            selectinload(Consent.responded_by).selectinload(User.organization),
        ]

    async def get_by_id_with_details(self, db: AsyncSession, consent_id: UUID, include_deleted: bool = False) -> Optional[Consent]:
        return await self.get_by_id(db, consent_id, options=self.get_eager_options(), include_deleted=include_deleted)

    async def list_consents_paginated(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        status_filter: Optional[ConsentRequestStatusEnum] = None,
        client_id: Optional[UUID] = None,
        include_deleted: bool = False,
        only_deleted: bool = False,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Tuple[List[Consent], int]:
        query = select(Consent).options(*self.get_eager_options())

        if only_deleted:
            query = query.where(Consent.is_deleted == True)
        elif not include_deleted:
            query = query.where(Consent.is_deleted == False)

        if search:
            search_fmt = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Consent.title.ilike(search_fmt),
                    Consent.description.ilike(search_fmt),
                )
            )

        if status_filter:
            query = query.where(Consent.status == status_filter)

        if client_id:
            query = query.where(Consent.client_id == client_id)

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        # Sort & Paginate
        sort_column = getattr(Consent, sort_by, Consent.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))

        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await db.execute(query)
        consents = list(result.scalars().all())

        return consents, total


consent_repository = ConsentRepository()
