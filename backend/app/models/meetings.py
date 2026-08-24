import enum
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class MeetingStatusEnum(str, enum.Enum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


class MeetingTypeEnum(str, enum.Enum):
    IN_PERSON = "in_person"
    VIDEO_CALL = "video_call"
    PHONE_CALL = "phone_call"
    OTHER = "other"


class Meeting(BaseCRMModel):
    __tablename__ = "meetings"

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    meeting_type: Mapped[MeetingTypeEnum] = mapped_column(
        Enum(MeetingTypeEnum, native_enum=False),
        default=MeetingTypeEnum.IN_PERSON,
        nullable=False,
    )
    status: Mapped[MeetingStatusEnum] = mapped_column(
        Enum(MeetingStatusEnum, native_enum=False),
        default=MeetingStatusEnum.SCHEDULED,
        nullable=False,
        index=True,
    )

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata", nullable=False)

    # Foreign Keys
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    client = relationship("Client", foreign_keys=[client_id])
    project = relationship("Project", foreign_keys=[project_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    assignments = relationship("MeetingAssignment", back_populates="meeting", cascade="all, delete-orphan")
