import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Enum, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class AgreementTypeEnum(str, enum.Enum):
    NDA = "nda"
    MSA = "msa"
    SOW = "sow"
    SERVICE_AGREEMENT = "service_agreement"
    SLA = "sla"
    OTHER = "other"


class AgreementStatusEnum(str, enum.Enum):
    DRAFT = "draft"
    PENDING_SIGNATURE = "pending_signature"
    SIGNED = "signed"
    EXPIRED = "expired"
    TERMINATED = "terminated"
    REJECTED = "rejected"


class ConsentStatusEnum(str, enum.Enum):
    PENDING = "pending"
    CONSENT_GIVEN = "consent_given"
    CONSENT_REVOKED = "consent_revoked"
    DECLINED = "declined"


class Agreement(BaseCRMModel):
    __tablename__ = "agreements"

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    agreement_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

    type: Mapped[AgreementTypeEnum] = mapped_column(
        Enum(AgreementTypeEnum, native_enum=False),
        default=AgreementTypeEnum.SERVICE_AGREEMENT,
        nullable=False,
        index=True,
    )
    status: Mapped[AgreementStatusEnum] = mapped_column(
        Enum(AgreementStatusEnum, native_enum=False),
        default=AgreementStatusEnum.DRAFT,
        nullable=False,
        index=True,
    )
    consent_status: Mapped[ConsentStatusEnum] = mapped_column(
        Enum(ConsentStatusEnum, native_enum=False),
        default=ConsentStatusEnum.PENDING,
        nullable=False,
        index=True,
    )

    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # PDF File Metadata
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), default="application/pdf", nullable=True)
    file_checksum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Dates & Signatures
    effective_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expiration_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_by_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    signed_by_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Consent Tracking
    consent_given_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    consent_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Foreign Keys
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    parent_agreement_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agreements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    client = relationship("Client", foreign_keys=[client_id])
    assigned_admin = relationship("User", foreign_keys=[assigned_admin_id])
    parent_agreement = relationship("Agreement", remote_side="Agreement.id", backref="versions")
