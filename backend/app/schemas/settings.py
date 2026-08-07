from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator, model_validator
from app.schemas.user import UserRead


class CompanyProfileUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    domain: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None
    support_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not str(v).strip():
            raise ValueError("Company name cannot be empty")
        return str(v).strip() if v is not None else None


class CompanyProfileRead(BaseModel):
    id: UUID
    name: str
    legal_name: Optional[str] = None
    domain: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None
    support_email: Optional[str] = None
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    job_title: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_names(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not str(v).strip():
            raise ValueError("Name fields cannot be empty")
        return str(v).strip() if v is not None else None


class PasswordChangePayload(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("New password must be at least 8 characters long")
        return v

    @model_validator(mode="after")
    def check_passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirm password do not match")
        return self


class UserSettingsUpdate(BaseModel):
    timezone: Optional[str] = None
    language: Optional[str] = None

    email_notifications_enabled: Optional[bool] = None
    email_digest_frequency: Optional[str] = None
    invoice_email_alerts: Optional[bool] = None
    task_email_alerts: Optional[bool] = None
    chat_email_alerts: Optional[bool] = None

    in_app_notifications: Optional[bool] = None
    desktop_notifications: Optional[bool] = None
    task_assigned_alert: Optional[bool] = None
    agreement_signed_alert: Optional[bool] = None
    invoice_paid_alert: Optional[bool] = None
    chat_mention_alert: Optional[bool] = None


class UserSettingsRead(BaseModel):
    id: UUID
    user_id: UUID
    timezone: str = "Asia/Kolkata"
    language: str = "en"

    email_notifications_enabled: bool = True
    email_digest_frequency: str = "daily"
    invoice_email_alerts: bool = True
    task_email_alerts: bool = True
    chat_email_alerts: bool = True

    in_app_notifications: bool = True
    desktop_notifications: bool = False
    task_assigned_alert: bool = True
    agreement_signed_alert: bool = True
    invoice_paid_alert: bool = True
    chat_mention_alert: bool = True

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FullSettingsRead(BaseModel):
    user: UserRead
    settings: UserSettingsRead
    company: Optional[CompanyProfileRead] = None
