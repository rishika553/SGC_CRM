import uuid
from typing import Optional
from sqlalchemy import String, Text, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class AuditLog(BaseCRMModel):
    __tablename__ = "audit_logs"

    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    changes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
