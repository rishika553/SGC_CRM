import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Enum, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class ClientTierEnum(str, enum.Enum):
    ENTERPRISE = "enterprise"
    MID_MARKET = "mid_market"
    SMB = "smb"


class ClientStatusEnum(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PROSPECT = "prospect"
    ONBOARDING = "onboarding"
    CHURNED = "churned"
    SUSPENDED = "suspended"


class CommunicationTypeEnum(str, enum.Enum):
    MEETING = "meeting"
    CALL = "call"
    EMAIL = "email"
    NOTE = "note"


class Client(BaseCRMModel):
    __tablename__ = "clients"

    # Company Details
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    legal_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    company_size: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    annual_revenue: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[Optional[str]] = mapped_column(String(10), default="INR", nullable=True)

    # Tax & Identification
    gst_number: Mapped[Optional[str]] = mapped_column(String(15), nullable=True, index=True)
    pan_number: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, index=True)

    # Primary Contact Details
    primary_contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Address Details
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), default="India", nullable=True)
    billing_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Classification & Status
    tier: Mapped[ClientTierEnum] = mapped_column(
        Enum(ClientTierEnum, native_enum=False),
        default=ClientTierEnum.MID_MARKET,
        nullable=False,
        index=True,
    )
    status: Mapped[ClientStatusEnum] = mapped_column(
        Enum(ClientStatusEnum, native_enum=False),
        default=ClientStatusEnum.PROSPECT,
        nullable=False,
        index=True,
    )

    # Foreign Keys
    assigned_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    account_manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    assigned_admin = relationship("User", foreign_keys=[assigned_admin_id])
    account_manager = relationship("User", foreign_keys=[account_manager_id])
    contacts = relationship("Contact", back_populates="client", cascade="all, delete-orphan")
    communication_logs = relationship("CommunicationLog", back_populates="client", cascade="all, delete-orphan")
    client_rms = relationship("ClientRM", back_populates="client", cascade="all, delete-orphan")


class Contact(BaseCRMModel):
    __tablename__ = "contacts"

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_primary_contact: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Foreign Keys
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Relationships
    client = relationship("Client", back_populates="contacts")


class CommunicationLog(BaseCRMModel):
    __tablename__ = "communication_logs"

    type: Mapped[CommunicationTypeEnum] = mapped_column(
        Enum(CommunicationTypeEnum),
        default=CommunicationTypeEnum.MEETING,
        nullable=False,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    interaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Foreign Keys
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    logged_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Relationships
    client = relationship("Client", back_populates="communication_logs")
    contact = relationship("Contact")
    logged_by = relationship("User")
