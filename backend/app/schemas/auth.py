from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: str = Field(..., description="Email or Username")
    password: str
    portal: Optional[str] = Field(None, description="Portal context: 'superadmin' or 'client'")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, description="New password must be at least 8 characters")


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, description="New password must be at least 8 characters")
