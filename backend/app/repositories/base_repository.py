from typing import Generic, TypeVar, Type, Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, asc, desc
from app.db.base import BaseCRMModel

ModelType = TypeVar("ModelType", bound=BaseCRMModel)


class BaseRepository(Generic[ModelType]):
    """
    Generic Base Repository encapsulating async SQLAlchemy data access logic.
    """

    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get_by_id(
        self,
        db: AsyncSession,
        id: UUID,
        options: Optional[list] = None,
        include_deleted: bool = False
    ) -> Optional[ModelType]:
        query = select(self.model).where(self.model.id == id)
        if options:
            query = query.options(*options)

        if not include_deleted and hasattr(self.model, "is_deleted"):
            query = query.where(self.model.is_deleted == False)

        res = await db.execute(query)
        return res.scalar_one_or_none()

    async def list_all(
        self,
        db: AsyncSession,
        options: Optional[list] = None,
        include_deleted: bool = False
    ) -> List[ModelType]:
        query = select(self.model)
        if options:
            query = query.options(*options)

        if not include_deleted and hasattr(self.model, "is_deleted"):
            query = query.where(self.model.is_deleted == False)

        res = await db.execute(query)
        return list(res.scalars().all())

    async def create(self, db: AsyncSession, db_obj: ModelType, commit: bool = True) -> ModelType:
        db.add(db_obj)
        if commit:
            await db.commit()
            await db.refresh(db_obj)
        return db_obj

    async def update(self, db: AsyncSession, db_obj: ModelType, commit: bool = True) -> ModelType:
        if commit:
            await db.commit()
            await db.refresh(db_obj)
        return db_obj

    async def soft_delete(self, db: AsyncSession, db_obj: ModelType, user_id: Optional[UUID] = None, commit: bool = True) -> ModelType:
        if hasattr(db_obj, "soft_delete"):
            db_obj.soft_delete(user_id=user_id)
            if commit:
                await db.commit()
        return db_obj

    async def restore(self, db: AsyncSession, db_obj: ModelType, commit: bool = True) -> ModelType:
        if hasattr(db_obj, "restore"):
            db_obj.restore()
            if commit:
                await db.commit()
                await db.refresh(db_obj)
        return db_obj
