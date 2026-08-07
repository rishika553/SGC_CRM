from datetime import datetime, timezone
from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.models.invoices import Invoice, InvoicePayment, InvoiceStatusEnum
from app.models.clients import Client
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class InvoiceRepository(BaseRepository[Invoice]):
    def __init__(self):
        super().__init__(Invoice)

    def get_eager_options(self):
        return [
            selectinload(Invoice.client),
            selectinload(Invoice.project),
            selectinload(Invoice.assigned_admin).selectinload(User.role),
        ]

    async def get_by_id_with_details(self, db: AsyncSession, invoice_id: UUID, include_deleted: bool = False) -> Optional[Invoice]:
        loader = self.get_eager_options() + [
            selectinload(Invoice.payments).selectinload(InvoicePayment.recorded_by).selectinload(User.role)
        ]
        return await self.get_by_id(db, invoice_id, options=loader, include_deleted=include_deleted)

    async def list_invoices_paginated(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        status_filter: Optional[InvoiceStatusEnum] = None,
        client_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        overdue_only: bool = False,
        include_deleted: bool = False,
        only_deleted: bool = False,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Tuple[List[Invoice], int]:
        query = select(Invoice).options(*self.get_eager_options())

        if only_deleted:
            query = query.where(Invoice.is_deleted == True)
        elif not include_deleted:
            query = query.where(Invoice.is_deleted == False)

        if search:
            search_fmt = f"%{search.strip()}%"
            query = query.join(Invoice.client).where(
                or_(
                    Invoice.invoice_number.ilike(search_fmt),
                    Invoice.notes.ilike(search_fmt),
                    Client.name.ilike(search_fmt),
                )
            )

        if status_filter:
            query = query.where(Invoice.status == status_filter)

        if client_id:
            query = query.where(Invoice.client_id == client_id)

        if project_id:
            query = query.where(Invoice.project_id == project_id)

        if overdue_only:
            now = datetime.now(timezone.utc)
            query = query.where(
                Invoice.due_date < now,
                Invoice.status.not_in([InvoiceStatusEnum.PAID, InvoiceStatusEnum.CANCELLED])
            )

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        # Sort & Paginate
        sort_column = getattr(Invoice, sort_by, Invoice.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))

        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await db.execute(query)
        invoices = list(result.scalars().all())

        return invoices, total


invoice_repository = InvoiceRepository()
