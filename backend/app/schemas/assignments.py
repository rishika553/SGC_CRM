from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserRead


class AssignmentRead(BaseModel):
    id: UUID
    user_id: UUID
    assigned_by_id: Optional[UUID] = None
    assigned_at: datetime

    user: Optional[UserRead] = None
    assigned_by: Optional[UserRead] = None

    model_config = ConfigDict(from_attributes=True)


class ClientRMRead(BaseModel):
    id: UUID
    client_id: UUID
    user_id: UUID
    role_label: Optional[str] = None
    assigned_by_id: Optional[UUID] = None
    assigned_at: datetime

    user: Optional[UserRead] = None
    assigned_by: Optional[UserRead] = None

    model_config = ConfigDict(from_attributes=True)
