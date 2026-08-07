from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict


class UserBase(BaseModel):
    email: str
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    job_title: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role_id: UUID
    organization_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    job_title: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None


from app.models.role import UserRoleEnum

class RoleRead(BaseModel):
    id: UUID
    name: UserRoleEnum | str
    display_name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OrganizationRead(BaseModel):
    id: UUID
    name: str
    domain: Optional[str] = None
    industry: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserRead(UserBase):
    id: UUID
    is_active: bool
    is_verified: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    role: Optional[RoleRead] = None
    organization: Optional[OrganizationRead] = None

    model_config = ConfigDict(from_attributes=True)
