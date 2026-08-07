import os
import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException, CRMException
from app.core.security import verify_password, get_password_hash
from app.api.deps import get_current_user, require_roles, ADMIN_ROLES, ALL_ROLES
from app.models.user import User
from app.models.organization import Organization
from app.models.settings import UserSettings
from app.models.role import UserRoleEnum
from app.schemas.common import ResponseEnvelope
from app.schemas.user import UserRead
from app.schemas.settings import (
    CompanyProfileUpdate,
    CompanyProfileRead,
    UserProfileUpdate,
    PasswordChangePayload,
    UserSettingsUpdate,
    UserSettingsRead,
    FullSettingsRead,
)
from app.services.audit_service import log_audit_event

router = APIRouter()

AVATARS_DIR = os.path.join(os.getcwd(), "uploads", "avatars")
os.makedirs(AVATARS_DIR, exist_ok=True)


async def get_or_create_user_settings(db: AsyncSession, user_id: UUID) -> UserSettings:
    """
    Finds or creates default UserSettings for a given user.
    """
    stmt = select(UserSettings).where(UserSettings.user_id == user_id)
    res = await db.execute(stmt)
    settings_rec = res.scalar_one_or_none()

    if not settings_rec:
        settings_rec = UserSettings(
            user_id=user_id,
            timezone="Asia/Kolkata",
            language="en",
            created_by_id=user_id,
            updated_by_id=user_id,
        )
        db.add(settings_rec)
        await db.commit()
        await db.refresh(settings_rec)

    return settings_rec


@router.get("/profile", response_model=ResponseEnvelope[FullSettingsRead])
async def get_user_settings_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get full settings profile for current user (User info, User Preferences, Company Profile).
    """
    settings_rec = await get_or_create_user_settings(db, current_user.id)

    company_read = None
    if current_user.organization_id:
        stmt_org = select(Organization).where(Organization.id == current_user.organization_id)
        res_org = await db.execute(stmt_org)
        org = res_org.scalar_one_or_none()
        if org:
            company_read = CompanyProfileRead.model_validate(org)

    # Load role relationship
    stmt_user = select(User).options(selectinload(User.role)).where(User.id == current_user.id)
    res_user = await db.execute(stmt_user)
    user_loaded = res_user.scalar_one()

    return ResponseEnvelope(
        success=True,
        data=FullSettingsRead(
            user=UserRead.model_validate(user_loaded),
            settings=UserSettingsRead.model_validate(settings_rec),
            company=company_read,
        )
    )


@router.put("/profile", response_model=ResponseEnvelope[UserRead])
async def update_user_profile(
    payload: UserProfileUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update personal user profile details (first name, last name, phone, job title).
    """
    stmt = select(User).options(selectinload(User.role)).where(User.id == current_user.id)
    res = await db.execute(stmt)
    user = res.scalar_one()

    changes = {}
    update_data = payload.model_dump(exclude_unset=True)

    for field, new_val in update_data.items():
        if hasattr(user, field):
            old_val = getattr(user, field)
            if old_val != new_val:
                changes[field] = {"old": old_val, "new": new_val}
                setattr(user, field, new_val)

    if changes:
        user.updated_by_id = current_user.id
        await log_audit_event(
            db=db,
            action="USER_PROFILE_UPDATED",
            entity_name="User",
            entity_id=str(user.id),
            changes=changes,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        await db.refresh(user)

    return ResponseEnvelope(
        success=True,
        message="Profile details updated successfully",
        data=UserRead.model_validate(user)
    )


@router.post("/profile-photo", response_model=ResponseEnvelope[UserRead])
async def upload_profile_photo(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload user profile avatar photo.
    """
    filename = file.filename or "avatar.png"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
        raise CRMException(status_code=400, detail="Invalid image format. Supported formats: .png, .jpg, .jpeg, .webp, .gif")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5 MB max
        raise CRMException(status_code=400, detail="Profile photo size exceeds 5 MB limit")

    unique_name = f"avatar_{current_user.id.hex}{ext}"
    file_path = os.path.join(AVATARS_DIR, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    avatar_url = f"/api/v1/documents/stream-file?path={file_path}"

    stmt = select(User).options(selectinload(User.role)).where(User.id == current_user.id)
    res = await db.execute(stmt)
    user = res.scalar_one()

    old_avatar = user.avatar_url
    user.avatar_url = avatar_url
    user.updated_by_id = current_user.id

    await log_audit_event(
        db=db,
        action="AVATAR_UPDATED",
        entity_name="User",
        entity_id=str(user.id),
        changes={"avatar_url": {"old": old_avatar, "new": avatar_url}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(user)

    return ResponseEnvelope(
        success=True,
        message="Profile photo updated successfully",
        data=UserRead.model_validate(user)
    )


@router.put("/preferences", response_model=ResponseEnvelope[UserSettingsRead])
async def update_user_preferences(
    payload: UserSettingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update user preferences (timezone, language, email alerts, in-app notifications).
    """
    settings_rec = await get_or_create_user_settings(db, current_user.id)

    changes = {}
    update_data = payload.model_dump(exclude_unset=True)

    for field, new_val in update_data.items():
        if hasattr(settings_rec, field):
            old_val = getattr(settings_rec, field)
            if old_val != new_val:
                changes[field] = {"old": old_val, "new": new_val}
                setattr(settings_rec, field, new_val)

    if changes:
        settings_rec.updated_by_id = current_user.id
        await log_audit_event(
            db=db,
            action="PREFERENCES_UPDATED",
            entity_name="UserSettings",
            entity_id=str(settings_rec.id),
            changes=changes,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        await db.refresh(settings_rec)

    return ResponseEnvelope(
        success=True,
        message="Preferences updated successfully",
        data=UserSettingsRead.model_validate(settings_rec)
    )


@router.post("/password", response_model=ResponseEnvelope[dict])
async def change_user_password(
    payload: PasswordChangePayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Change user password with bcrypt verification of current password.
    """
    stmt = select(User).where(User.id == current_user.id)
    res = await db.execute(stmt)
    user = res.scalar_one()

    # Verify current password
    if not verify_password(payload.current_password, user.hashed_password):
        raise CRMException(status_code=400, detail="Incorrect current password")

    # Hash new password
    user.hashed_password = get_password_hash(payload.new_password)
    user.updated_by_id = current_user.id

    await log_audit_event(
        db=db,
        action="PASSWORD_CHANGED",
        entity_name="User",
        entity_id=str(user.id),
        changes={"password": "UPDATED"},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Password changed successfully",
        data={"updated": True}
    )


@router.get("/company", response_model=ResponseEnvelope[Optional[CompanyProfileRead]])
async def get_company_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get Organization company profile details.
    """
    if not current_user.organization_id:
        return ResponseEnvelope(success=True, data=None)

    stmt = select(Organization).where(Organization.id == current_user.organization_id)
    res = await db.execute(stmt)
    org = res.scalar_one_or_none()

    if not org:
        raise NotFoundException(detail="Organization profile not found")

    return ResponseEnvelope(
        success=True,
        data=CompanyProfileRead.model_validate(org)
    )


@router.put("/company", response_model=ResponseEnvelope[CompanyProfileRead])
async def update_company_profile(
    payload: CompanyProfileUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    """
    Update Organization company profile details (Restricted to Admin roles).
    """
    if not current_user.organization_id:
        # Create organization if none associated
        new_org = Organization(
            name=payload.name or "SGC Consulting Firm",
            legal_name=payload.legal_name,
            domain=payload.domain,
            industry=payload.industry,
            website=payload.website,
            tax_id=payload.tax_id,
            support_email=payload.support_email,
            phone=payload.phone,
            logo_url=payload.logo_url,
            address_line1=payload.address_line1,
            address_line2=payload.address_line2,
            city=payload.city,
            state=payload.state,
            postal_code=payload.postal_code,
            country=payload.country or "India",
            description=payload.description,
            created_by_id=current_user.id,
            updated_by_id=current_user.id,
        )
        db.add(new_org)
        await db.commit()

        # Associate with current user
        stmt_u = select(User).where(User.id == current_user.id)
        res_u = await db.execute(stmt_u)
        user_rec = res_u.scalar_one()
        user_rec.organization_id = new_org.id
        await db.commit()

        return ResponseEnvelope(
            success=True,
            message="Company profile created",
            data=CompanyProfileRead.model_validate(new_org)
        )

    stmt = select(Organization).where(Organization.id == current_user.organization_id)
    res = await db.execute(stmt)
    org = res.scalar_one_or_none()

    if not org:
        raise NotFoundException(detail="Organization profile not found")

    changes = {}
    update_data = payload.model_dump(exclude_unset=True)

    for field, new_val in update_data.items():
        if hasattr(org, field):
            old_val = getattr(org, field)
            if old_val != new_val:
                changes[field] = {"old": old_val, "new": new_val}
                setattr(org, field, new_val)

    if changes:
        org.updated_by_id = current_user.id
        await log_audit_event(
            db=db,
            action="COMPANY_PROFILE_UPDATED",
            entity_name="Organization",
            entity_id=str(org.id),
            changes=changes,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        await db.refresh(org)

    return ResponseEnvelope(
        success=True,
        message="Company profile updated successfully",
        data=CompanyProfileRead.model_validate(org)
    )
