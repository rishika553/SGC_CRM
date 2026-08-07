import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Enum, Integer, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class MessageTypeEnum(str, enum.Enum):
    TEXT = "text"
    FILE = "file"
    IMAGE = "image"
    AUDIO = "audio"
    SYSTEM = "system"


class Conversation(BaseCRMModel):
    __tablename__ = "conversations"

    user1_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user2_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        UniqueConstraint("user1_id", "user2_id", name="uq_conversation_users"),
    )

    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan")


class ChatMessage(BaseCRMModel):
    __tablename__ = "chat_messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    message_type: Mapped[MessageTypeEnum] = mapped_column(
        Enum(MessageTypeEnum, native_enum=False),
        default=MessageTypeEnum.TEXT,
        nullable=False,
    )
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # File Attachments
    attachment_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    attachment_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    attachment_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    attachment_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Read Receipts
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
