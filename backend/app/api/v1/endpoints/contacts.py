from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.exceptions import NotFoundException
from app.api.deps import get_current_user, require_roles, ADMIN_ROLES
from app.models.clients import Contact, Client
from app.models.user import User
from app.schemas.common import ResponseEnvelope
from app.schemas.clients import ContactRead, ContactCreate

router = APIRouter()


@router.post("", response_model=ResponseEnvelope[ContactRead], status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: ContactCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt_client = select(Client).where(Client.id == payload.client_id, Client.is_deleted == False)
    res_client = await db.execute(stmt_client)
    if not res_client.scalar_one_or_none():
        raise NotFoundException(detail="Client company account not found")

    new_contact = Contact(
        client_id=payload.client_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        job_title=payload.job_title,
        department=payload.department,
        is_primary_contact=payload.is_primary_contact,
        created_by_id=current_user.id,
    )
    db.add(new_contact)
    await db.commit()
    await db.refresh(new_contact)

    return ResponseEnvelope(
        success=True,
        message="Contact stakeholder created successfully",
        data=ContactRead.model_validate(new_contact)
    )


@router.delete("/{contact_id}", response_model=ResponseEnvelope[dict])
async def delete_contact(
    contact_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Contact).where(Contact.id == contact_id, Contact.is_deleted == False)
    res = await db.execute(stmt)
    contact = res.scalar_one_or_none()

    if not contact:
        raise NotFoundException(detail="Contact not found")

    contact.soft_delete(user_id=current_user.id)
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Contact record soft-deleted",
        data={"deleted": True}
    )
