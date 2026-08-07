from datetime import datetime
from typing import Optional, List, Any, Dict
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator
from app.models.chat import MessageTypeEnum
from app.schemas.user import UserRead


class ChatMessageCreate(BaseModel):
    recipient_id: UUID
    content: Optional[str] = None
    message_type: MessageTypeEnum = MessageTypeEnum.TEXT
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_size: Optional[int] = None


class ChatMessageRead(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    recipient_id: UUID
    message_type: MessageTypeEnum
    content: Optional[str] = None

    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_size: Optional[int] = None

    is_read: bool = False
    read_at: Optional[datetime] = None

    sender: Optional[UserRead] = None
    recipient: Optional[UserRead] = None

    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationRead(BaseModel):
    id: UUID
    user1_id: UUID
    user2_id: UUID
    other_user: Optional[UserRead] = None
    last_message: Optional[ChatMessageRead] = None
    unread_count: int = 0
    last_message_at: datetime
    is_online: bool = False

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MarkReadPayload(BaseModel):
    conversation_id: Optional[UUID] = None
    other_user_id: Optional[UUID] = None


class ChatAttachmentResponse(BaseModel):
    attachment_url: str
    attachment_name: str
    attachment_type: str
    attachment_size: int


class WSEventPayload(BaseModel):
    event: str
    data: Dict[str, Any]
