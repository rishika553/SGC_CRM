from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.api.deps import get_current_user, require_roles, ADMIN_ROLES
from app.models.role import Role
from app.schemas.common import ResponseEnvelope
from app.schemas.user import RoleRead

router = APIRouter()


@router.get("", response_model=ResponseEnvelope[List[RoleRead]])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Role).order_by(Role.name.asc())
    result = await db.execute(stmt)
    roles = result.scalars().all()
    
    return ResponseEnvelope(
        success=True,
        data=[RoleRead.model_validate(r) for r in roles]
    )
