import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Enum, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class ConsentRequestStatusEnum(str, enum.Enum):
    PENDING = "pending"
    ALLOWED = "allowed"
    DENIED = "denied"


class Consent(BaseCRMModel):
    __tablename__ = "consents"

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[ConsentRequestStatusEnum] = mapped_column(
        Enum(ConsentRequestStatusEnum, native_enum=False),
        default=ConsentRequestStatusEnum.PENDING,
        nullable=False,
        index=True,
    )

    # Attachment Metadata
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_checksum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Response Tracking
    responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    denial_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    response_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Foreign Keys
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    responded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    client = relationship("Client", foreign_keys=[client_id])
    responded_by = relationship("User", foreign_keys=[responded_by_id])
