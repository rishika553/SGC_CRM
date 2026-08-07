from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.models.clients import Client, ClientTierEnum, ClientStatusEnum
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class ClientRepository(BaseRepository[Client]):
    def __init__(self):
        super().__init__(Client)

    def get_eager_options(self):
        return [
            selectinload(Client.assigned_admin).selectinload(User.role),
            selectinload(Client.account_manager).selectinload(User.role),
            selectinload(Client.contacts),
        ]

    async def get_by_id_with_details(self, db: AsyncSession, client_id: UUID, include_deleted: bool = False) -> Optional[Client]:
        return await self.get_by_id(db, client_id, options=self.get_eager_options(), include_deleted=include_deleted)

    async def list_clients_paginated(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        tier: Optional[ClientTierEnum] = None,
        status_filter: Optional[ClientStatusEnum] = None,
        assigned_admin_id: Optional[UUID] = None,
        state: Optional[str] = None,
        industry: Optional[str] = None,
        include_deleted: bool = False,
        only_deleted: bool = False,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Tuple[List[Client], int]:
        query = select(Client).options(*self.get_eager_options())

        if only_deleted:
            query = query.where(Client.is_deleted == True)
        elif not include_deleted:
            query = query.where(Client.is_deleted == False)

        if search:
            search_fmt = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Client.name.ilike(search_fmt),
                    Client.legal_name.ilike(search_fmt),
                    Client.gst_number.ilike(search_fmt),
                    Client.pan_number.ilike(search_fmt),
                    Client.email.ilike(search_fmt),
                    Client.phone.ilike(search_fmt),
                    Client.city.ilike(search_fmt),
                    Client.state.ilike(search_fmt),
                    Client.industry.ilike(search_fmt),
                )
            )

        if tier:
            query = query.where(Client.tier == tier)

        if status_filter:
            query = query.where(Client.status == status_filter)

        if assigned_admin_id:
            query = query.where(
                or_(
                    Client.assigned_admin_id == assigned_admin_id,
                    Client.account_manager_id == assigned_admin_id
                )
            )

        if state:
            query = query.where(Client.state.ilike(f"%{state.strip()}%"))

        if industry:
            query = query.where(Client.industry.ilike(f"%{industry.strip()}%"))

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        # Sort & Paginate
        sort_column = getattr(Client, sort_by, Client.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))

        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await db.execute(query)
        clients = list(result.scalars().all())

        return clients, total


client_repository = ClientRepository()
