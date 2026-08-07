import enum
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Enum, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class DocumentCategoryEnum(str, enum.Enum):
    CONTRACT = "contract"
    INVOICE_BILL = "invoice_bill"
    PROPOSAL = "proposal"
    REPORT = "report"
    COMPLIANCE = "compliance"
    TECHNICAL_DOC = "technical_doc"
    TAX_DOC = "tax_doc"
    OTHER = "other"


class Document(BaseCRMModel):
    __tablename__ = "documents"

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_type: Mapped[str] = mapped_column(String(50), default="supabase", nullable=False)
    public_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False, default="application/octet-stream")
    file_extension: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    file_checksum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    category: Mapped[DocumentCategoryEnum] = mapped_column(
        Enum(DocumentCategoryEnum, native_enum=False),
        default=DocumentCategoryEnum.OTHER,
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_secured: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Foreign Keys
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    parent_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    client = relationship("Client", foreign_keys=[client_id])
    project = relationship("Project", foreign_keys=[project_id])
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
    parent_document = relationship("Document", remote_side="Document.id", backref="versions")
