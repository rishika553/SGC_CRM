from typing import Optional
from sqlalchemy import String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class Organization(BaseCRMModel):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    legal_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, unique=True, index=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tax_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    support_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Address
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), default="India", nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
