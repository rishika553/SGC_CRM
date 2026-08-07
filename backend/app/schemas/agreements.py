from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from app.models.agreements import AgreementTypeEnum, AgreementStatusEnum, ConsentStatusEnum
from app.schemas.user import UserRead
from app.schemas.clients import ClientRead


class AgreementBase(BaseModel):
    title: str
    type: AgreementTypeEnum = AgreementTypeEnum.SERVICE_AGREEMENT
    status: AgreementStatusEnum = AgreementStatusEnum.DRAFT
    consent_status: ConsentStatusEnum = ConsentStatusEnum.PENDING
    description: Optional[str] = None
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    signed_at: Optional[datetime] = None
    signed_by_name: Optional[str] = None
    signed_by_email: Optional[EmailStr] = None
    consent_given_at: Optional[datetime] = None
    consent_notes: Optional[str] = None


class AgreementCreate(BaseModel):
    title: str
    type: AgreementTypeEnum = AgreementTypeEnum.SERVICE_AGREEMENT
    client_id: UUID
    assigned_admin_id: Optional[UUID] = None
    description: Optional[str] = None
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    agreement_number: Optional[str] = None


class AgreementUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[AgreementTypeEnum] = None
    status: Optional[AgreementStatusEnum] = None
    consent_status: Optional[ConsentStatusEnum] = None
    description: Optional[str] = None
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    assigned_admin_id: Optional[UUID] = None


class AgreementSignPayload(BaseModel):
    signed_by_name: str
    signed_by_email: EmailStr
    signed_at: Optional[datetime] = None


class AgreementConsentPayload(BaseModel):
    consent_status: ConsentStatusEnum
    consent_notes: Optional[str] = None


class AgreementCreateVersionPayload(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None


class AgreementRead(BaseModel):
    id: UUID
    title: str
    agreement_number: str
    type: AgreementTypeEnum
    status: AgreementStatusEnum
    consent_status: ConsentStatusEnum
    version: int
    description: Optional[str] = None

    # PDF Metadata
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    file_checksum: Optional[str] = None

    # Dates & Signatures
    effective_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    signed_at: Optional[datetime] = None
    signed_by_name: Optional[str] = None
    signed_by_email: Optional[str] = None
    consent_given_at: Optional[datetime] = None
    consent_notes: Optional[str] = None

    # Relations
    client_id: UUID
    assigned_admin_id: Optional[UUID] = None
    parent_agreement_id: Optional[UUID] = None

    client: Optional[ClientRead] = None
    assigned_admin: Optional[UserRead] = None

    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgreementVersionRead(BaseModel):
    id: UUID
    title: str
    agreement_number: str
    version: int
    status: AgreementStatusEnum
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgreementDetailRead(AgreementRead):
    versions: List[AgreementVersionRead] = []

    model_config = ConfigDict(from_attributes=True)
