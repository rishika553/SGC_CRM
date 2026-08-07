import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class TaskStatusEnum(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskPriorityEnum(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Task(BaseCRMModel):
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    task_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[TaskStatusEnum] = mapped_column(
        Enum(TaskStatusEnum, native_enum=False),
        default=TaskStatusEnum.TODO,
        nullable=False,
        index=True,
    )
    priority: Mapped[TaskPriorityEnum] = mapped_column(
        Enum(TaskPriorityEnum, native_enum=False),
        default=TaskPriorityEnum.MEDIUM,
        nullable=False,
        index=True,
    )

    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Foreign Keys
    assigned_to_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    parent_task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Relationships
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    project = relationship("Project", foreign_keys=[project_id])
    client = relationship("Client", foreign_keys=[client_id])
    parent_task = relationship("Task", remote_side="Task.id", backref="subtasks")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")


class TaskComment(BaseCRMModel):
    __tablename__ = "task_comments"

    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Foreign Keys
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Relationships
    task = relationship("Task", back_populates="comments")
    user = relationship("User")
