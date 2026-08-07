import uuid
from typing import Optional
from sqlalchemy import String, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class User(BaseCRMModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Foreign Keys
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Relationships
    organization = relationship("Organization", back_populates="users")
    role = relationship("Role", back_populates="users")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
