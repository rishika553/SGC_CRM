import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    create_password_reset_token,
    decode_token,
    get_password_hash,
)
from app.core.exceptions import UnauthorizedException, ConflictException, NotFoundException, ForbiddenException
from app.core.config import settings
from app.api.deps import get_current_user
from app.models.user import User
from app.models.role import Role, UserRoleEnum
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
)
from app.schemas.common import ResponseEnvelope
from app.schemas.user import UserRead, UserCreate
from app.services.audit_service import log_audit_event

router = APIRouter()


@router.post("/login", response_model=ResponseEnvelope[dict])
async def login(payload: LoginRequest):
    raise UnauthorizedException(
        detail="Custom FastAPI login is disabled. All authentications must use Supabase Auth (supabase.auth.signInWithPassword)."
    )


@router.post("/logout", response_model=ResponseEnvelope[dict])
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    await log_audit_event(
        db=db,
        action="LOGOUT",
        entity_name="User",
        entity_id=str(current_user.id),
        changes={"email": current_user.email},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Logged out successfully",
        data={"logged_out": True}
    )


@router.post("/refresh", response_model=ResponseEnvelope[TokenResponse])
async def refresh_access_token(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise UnauthorizedException(detail="Invalid refresh token type")
        user_id = uuid.UUID(data["sub"])
    except Exception:
        raise UnauthorizedException(detail="Invalid or expired refresh token")

    stmt = select(User).options(
        selectinload(User.role),
        selectinload(User.organization)
    ).where(User.id == user_id, User.is_deleted == False)

    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not user.is_active:
        raise UnauthorizedException(detail="User not found or inactive")

    new_access_token = create_access_token(
        subject=user.id,
        additional_claims={"role": user.role.name if user.role else "consultant"}
    )
    new_refresh_token = create_refresh_token(subject=user.id)

    return ResponseEnvelope(
        success=True,
        message="Token refreshed successfully",
        data=TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserRead.model_validate(user)
        )
    )


@router.post("/forgot-password", response_model=ResponseEnvelope[dict])
async def request_password_reset(payload: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == payload.email, User.is_deleted == False)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    # Always return success message to prevent user enumeration
    if user:
        reset_token = create_password_reset_token(user.email)
        print(f"🔑 Password reset token for {user.email}: {reset_token}")

    return ResponseEnvelope(
        success=True,
        message="If an account with that email exists, a password reset link has been dispatched.",
        data={"sent": True}
    )


@router.post("/reset-password", response_model=ResponseEnvelope[dict])
async def confirm_password_reset(payload: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    try:
        data = decode_token(payload.token)
        if data.get("type") != "password_reset":
            raise UnauthorizedException(detail="Invalid password reset token")
        email = data["sub"]
    except Exception:
        raise UnauthorizedException(detail="Invalid or expired reset token")

    stmt = select(User).where(User.email == email, User.is_deleted == False)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise NotFoundException(detail="User not found")

    user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Password updated successfully. You may now log in.",
        data={"updated": True}
    )


@router.post("/register-initial-admin", response_model=ResponseEnvelope[UserRead], status_code=status.HTTP_201_CREATED)
async def register_initial_admin(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    stmt_check = select(User)
    existing_user_res = await db.execute(stmt_check)
    if existing_user_res.first():
        raise ConflictException(detail="SuperAdmin account already initialized")

    stmt_role = select(Role).where(Role.name == UserRoleEnum.SUPER_ADMIN)
    role_res = await db.execute(stmt_role)
    role = role_res.scalar_one_or_none()

    if not role:
        role = Role(
            name=UserRoleEnum.SUPER_ADMIN,
            display_name="Super Administrator",
            description="Full system control and configuration access"
        )
        db.add(role)
        await db.flush()

    new_user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone_number=payload.phone_number,
        job_title=payload.job_title or "Managing Director",
        role_id=role.id,
        is_active=True,
        is_verified=True,
    )
    db.add(new_user)
    await db.commit()

    stmt_created = select(User).options(
        selectinload(User.role),
        selectinload(User.organization)
    ).where(User.id == new_user.id)
    res = await db.execute(stmt_created)
    created_user = res.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Initial administrator account created successfully",
        data=UserRead.model_validate(created_user)
    )
