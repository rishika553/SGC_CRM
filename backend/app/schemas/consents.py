from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator
from app.models.consents import ConsentRequestStatusEnum
from app.schemas.clients import ClientRead
from app.schemas.user import UserRead


class ConsentResponsePayload(BaseModel):
    status: ConsentRequestStatusEnum
    denial_reason: Optional[str] = None
    response_notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_response_status(cls, v: ConsentRequestStatusEnum) -> ConsentRequestStatusEnum:
        if v == ConsentRequestStatusEnum.PENDING:
            raise ValueError("Response status must be either 'allowed' or 'denied'")
        return v


class ConsentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class ConsentRead(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    status: ConsentRequestStatusEnum

    # Attachment Metadata
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None

    # Response Tracking
    responded_at: Optional[datetime] = None
    denial_reason: Optional[str] = None
    response_notes: Optional[str] = None

    # Relations
    client_id: UUID
    responded_by_id: Optional[UUID] = None
    created_by_id: Optional[UUID] = None

    client: Optional[ClientRead] = None
    responded_by: Optional[UserRead] = None

    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
