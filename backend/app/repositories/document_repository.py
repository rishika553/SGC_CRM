from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.models.documents import Document, DocumentCategoryEnum
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    def __init__(self):
        super().__init__(Document)

    def get_eager_options(self):
        return [
            selectinload(Document.client),
            selectinload(Document.project),
            selectinload(Document.uploaded_by).selectinload(User.role),
            selectinload(Document.versions),
        ]

    async def get_by_id_with_details(self, db: AsyncSession, document_id: UUID, include_deleted: bool = False) -> Optional[Document]:
        return await self.get_by_id(db, document_id, options=self.get_eager_options(), include_deleted=include_deleted)

    async def list_documents_paginated(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        category_filter: Optional[DocumentCategoryEnum] = None,
        client_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        mime_type: Optional[str] = None,
        include_deleted: bool = False,
        only_deleted: bool = False,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Tuple[List[Document], int]:
        query = select(Document).options(*self.get_eager_options())

        if only_deleted:
            query = query.where(Document.is_deleted == True)
        elif not include_deleted:
            query = query.where(Document.is_deleted == False)

        if search:
            search_fmt = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Document.title.ilike(search_fmt),
                    Document.file_name.ilike(search_fmt),
                    Document.description.ilike(search_fmt),
                )
            )

        if category_filter:
            query = query.where(Document.category == category_filter)

        if client_id:
            query = query.where(Document.client_id == client_id)

        if project_id:
            query = query.where(Document.project_id == project_id)

        if mime_type:
            query = query.where(Document.mime_type.ilike(f"%{mime_type.strip()}%"))

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_res = await db.execute(count_query)
        total = total_res.scalar_one()

        # Sort & Paginate
        sort_column = getattr(Document, sort_by, Document.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))

        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        result = await db.execute(query)
        documents = list(result.scalars().all())

        return documents, total


document_repository = DocumentRepository()
