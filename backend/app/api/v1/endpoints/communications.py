from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import NotFoundException
from app.api.deps import get_current_user
from app.models.clients import CommunicationLog, Client
from app.models.user import User
from app.schemas.common import ResponseEnvelope
from app.schemas.clients import CommunicationLogRead, CommunicationLogCreate

router = APIRouter()


@router.post("", response_model=ResponseEnvelope[CommunicationLogRead], status_code=status.HTTP_201_CREATED)
async def create_communication_log(
    payload: CommunicationLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt_client = select(Client).where(Client.id == payload.client_id, Client.is_deleted == False)
    res_client = await db.execute(stmt_client)
    if not res_client.scalar_one_or_none():
        raise NotFoundException(detail="Client company account not found")

    new_log = CommunicationLog(
        client_id=payload.client_id,
        contact_id=payload.contact_id,
        logged_by_id=current_user.id,
        type=payload.type,
        subject=payload.subject,
        notes=payload.notes,
        interaction_date=payload.interaction_date or datetime.now(timezone.utc),
        created_by_id=current_user.id,
    )
    db.add(new_log)
    await db.commit()

    stmt_created = select(CommunicationLog).options(
        selectinload(CommunicationLog.logged_by).selectinload(User.role),
        selectinload(CommunicationLog.contact)
    ).where(CommunicationLog.id == new_log.id)
    res = await db.execute(stmt_created)
    created_item = res.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Communication interaction logged successfully",
        data=CommunicationLogRead.model_validate(created_item)
    )
