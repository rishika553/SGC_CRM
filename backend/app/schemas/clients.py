import re
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from app.models.clients import ClientTierEnum, ClientStatusEnum, CommunicationTypeEnum
from app.schemas.user import UserRead


# Regular expression constants for Indian GSTIN and PAN validation
GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
PHONE_REGEX = re.compile(r"^\+?[0-9\s\-]{7,15}$")
POSTAL_CODE_REGEX = re.compile(r"^[0-9A-Za-z\s\-]{3,10}$")


class ContactBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    is_primary_contact: bool = False

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v or not str(v).strip():
            return None
        v = str(v).strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Invalid phone number format")
        return v


class ContactCreate(ContactBase):
    client_id: UUID


class ContactRead(ContactBase):
    id: UUID
    client_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientBase(BaseModel):
    # Company Details
    name: str
    legal_name: Optional[str] = None
    company_type: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    website: Optional[str] = None
    annual_revenue: Optional[float] = None
    currency: Optional[str] = "INR"

    # Tax & Identification
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None

    # Primary Contact Details
    primary_contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    # Address Details
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "India"
    billing_address: Optional[str] = None

    # Classification & Status
    tier: ClientTierEnum = ClientTierEnum.MID_MARKET
    status: ClientStatusEnum = ClientStatusEnum.PROSPECT

    # Field Validators for Email, GST, PAN, Phone, Postal Code
    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if not v or not str(v).strip():
            return None
        return str(v).strip()

    @field_validator("gst_number", mode="before")
    @classmethod
    def validate_gst(cls, v: Optional[str]) -> Optional[str]:
        if not v or not str(v).strip():
            return None
        v = str(v).strip().upper()
        if not GSTIN_REGEX.match(v):
            raise ValueError("Invalid GSTIN format. Expected 15-character alphanumeric format (e.g. 27AAPFU0939F1ZV)")
        return v

    @field_validator("pan_number", mode="before")
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        if not v or not str(v).strip():
            return None
        v = str(v).strip().upper()
        if not PAN_REGEX.match(v):
            raise ValueError("Invalid PAN format. Expected 10-character alphanumeric format (e.g. ABCDE1234F)")
        return v

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v or not str(v).strip():
            return None
        v = str(v).strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Invalid phone number format")
        return v

    @field_validator("postal_code", mode="before")
    @classmethod
    def validate_postal_code(cls, v: Optional[str]) -> Optional[str]:
        if not v or not str(v).strip():
            return None
        v = str(v).strip()
        if not POSTAL_CODE_REGEX.match(v):
            raise ValueError("Invalid postal code format")
        return v


class ClientCreate(ClientBase):
    assigned_admin_id: Optional[UUID] = None
    account_manager_id: Optional[UUID] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    company_type: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    website: Optional[str] = None
    annual_revenue: Optional[float] = None
    currency: Optional[str] = None

    gst_number: Optional[str] = None
    pan_number: Optional[str] = None

    primary_contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    billing_address: Optional[str] = None

    tier: Optional[ClientTierEnum] = None
    status: Optional[ClientStatusEnum] = None

    assigned_admin_id: Optional[UUID] = None
    account_manager_id: Optional[UUID] = None

    @field_validator("gst_number", mode="before")
    @classmethod
    def validate_gst(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        v = str(v).strip().upper()
        if not GSTIN_REGEX.match(v):
            raise ValueError("Invalid GSTIN format. Expected 15-character alphanumeric format (e.g. 27AAPFU0939F1ZV)")
        return v

    @field_validator("pan_number", mode="before")
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        v = str(v).strip().upper()
        if not PAN_REGEX.match(v):
            raise ValueError("Invalid PAN format. Expected 10-character alphanumeric format (e.g. ABCDE1234F)")
        return v

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        v = str(v).strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Invalid phone number format")
        return v

    @field_validator("postal_code", mode="before")
    @classmethod
    def validate_postal_code(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        v = str(v).strip()
        if not POSTAL_CODE_REGEX.match(v):
            raise ValueError("Invalid postal code format")
        return v


class CommunicationLogBase(BaseModel):
    type: CommunicationTypeEnum = CommunicationTypeEnum.MEETING
    subject: str
    notes: str
    interaction_date: Optional[datetime] = None


class CommunicationLogCreate(CommunicationLogBase):
    client_id: UUID
    contact_id: Optional[UUID] = None


class CommunicationLogRead(CommunicationLogBase):
    id: UUID
    client_id: UUID
    contact_id: Optional[UUID] = None
    logged_by: UserRead
    contact: Optional[ContactRead] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientRead(ClientBase):
    id: UUID
    assigned_admin_id: Optional[UUID] = None
    account_manager_id: Optional[UUID] = None
    assigned_admin: Optional[UserRead] = None
    account_manager: Optional[UserRead] = None
    contacts: List[ContactRead] = []
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientDetailRead(ClientRead):
    communication_logs: List[CommunicationLogRead] = []

    model_config = ConfigDict(from_attributes=True)


class ProvisionClientAccountRequest(BaseModel):
    client_name: str
    first_name: str
    last_name: str
    username_or_email: str
    password: str
    job_title: Optional[str] = "Client Stakeholder"
    tier: ClientTierEnum = ClientTierEnum.MID_MARKET
    industry: Optional[str] = None


class ProvisionClientAccountResponse(BaseModel):
    client: ClientRead
    user: UserRead
    login_username: str

