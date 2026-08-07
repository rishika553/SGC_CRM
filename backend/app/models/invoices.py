import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Enum, Float, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class InvoiceStatusEnum(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    UNPAID = "unpaid"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class Invoice(BaseCRMModel):
    __tablename__ = "invoices"

    invoice_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    issue_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Financial Breakdown
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tax_rate: Mapped[float] = mapped_column(Float, nullable=False, default=18.0)
    tax_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    paid_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    outstanding_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Status & Notes
    status: Mapped[InvoiceStatusEnum] = mapped_column(
        Enum(InvoiceStatusEnum, native_enum=False),
        default=InvoiceStatusEnum.UNPAID,
        nullable=False,
        index=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pdf_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

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
    assigned_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    client = relationship("Client", foreign_keys=[client_id])
    project = relationship("Project", foreign_keys=[project_id])
    assigned_admin = relationship("User", foreign_keys=[assigned_admin_id])
    payments = relationship("InvoicePayment", back_populates="invoice", cascade="all, delete-orphan")


class InvoicePayment(BaseCRMModel):
    __tablename__ = "invoice_payments"

    payment_amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    payment_method: Mapped[str] = mapped_column(String(100), nullable=False, default="Bank Transfer / NEFT")
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Foreign Keys
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recorded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")
    recorded_by = relationship("User")
