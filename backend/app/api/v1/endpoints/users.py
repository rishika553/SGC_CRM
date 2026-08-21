from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash
from app.core.exceptions import (
    UnauthorizedException,
    ConflictException,
    NotFoundException,
    ForbiddenException,
)
from app.api.deps import get_current_user, require_roles, ADMIN_ROLES, SUPER_ADMIN_ROLES
from app.models.user import User
from app.models.role import Role, UserRoleEnum
from app.schemas.common import ResponseEnvelope, PaginatedResponse, PaginationMeta
from app.schemas.user import UserRead, UserCreate, UserUpdate
from app.schemas.auth import PasswordChangeRequest

router = APIRouter()


@router.get("/superadmin", response_model=ResponseEnvelope[UserRead])
async def get_super_admin_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(User).options(selectinload(User.role)).join(User.role).where(
        Role.name == UserRoleEnum.SUPER_ADMIN,
        User.is_deleted == False
    ).limit(1)
    res = await db.execute(stmt)
    admin_user = res.scalar_one_or_none()

    if not admin_user:
        raise NotFoundException(detail="Super Admin user profile not found")

    return ResponseEnvelope(
        success=True,
        data=UserRead.model_validate(admin_user)
    )


@router.get("/me", response_model=ResponseEnvelope[UserRead])
async def get_my_profile(current_user: User = Depends(get_current_user)):
    import time
    t0 = time.perf_counter()
    response = ResponseEnvelope(
        success=True,
        data=UserRead.model_validate(current_user)
    )
    print(f"[ME] RESPONSE: {(time.perf_counter() - t0) * 1000:.1f} ms")
    return response


@router.put("/me", response_model=ResponseEnvelope[UserRead])
async def update_my_profile(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if payload.first_name is not None:
        current_user.first_name = payload.first_name
    if payload.last_name is not None:
        current_user.last_name = payload.last_name
    if payload.phone_number is not None:
        current_user.phone_number = payload.phone_number
    if payload.job_title is not None:
        current_user.job_title = payload.job_title
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url

    await db.commit()
    await db.refresh(current_user)

    return ResponseEnvelope(
        success=True,
        message="Profile updated successfully",
        data=UserRead.model_validate(current_user)
    )


@router.put("/me/change-password", response_model=ResponseEnvelope[dict])
async def change_password(
    payload: PasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise UnauthorizedException(detail="Current password is incorrect")

    current_user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Password changed successfully",
        data={"updated": True}
    )


@router.get("", response_model=PaginatedResponse[UserRead])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    query = select(User).options(
        selectinload(User.role),
        selectinload(User.organization)
    ).where(User.is_deleted == False)

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (User.first_name.ilike(search_filter)) |
            (User.last_name.ilike(search_filter)) |
            (User.email.ilike(search_filter))
        )

    if role_id:
        query = query.where(User.role_id == role_id)

    if is_active is not None:
        query = query.where(User.is_active == is_active)

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Pagination execution
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        success=True,
        data=[UserRead.model_validate(u) for u in users],
        meta=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )
    )


@router.post("", response_model=ResponseEnvelope[UserRead], status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES))
):
    stmt_check = select(User).where(User.email == payload.email, User.is_deleted == False)
    res_check = await db.execute(stmt_check)
    if res_check.scalar_one_or_none():
        raise ConflictException(detail=f"User with email {payload.email} already exists")

    stmt_role = select(Role).where(Role.id == payload.role_id)
    res_role = await db.execute(stmt_role)
    role = res_role.scalar_one_or_none()
    if not role:
        raise NotFoundException(detail="Specified role not found")

    new_user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone_number=payload.phone_number,
        job_title=payload.job_title,
        role_id=role.id,
        organization_id=payload.organization_id,
        is_active=True,
        is_verified=True,
        created_by_id=current_user.id,
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
        message="User created successfully",
        data=UserRead.model_validate(created_user)
    )


@router.get("/{user_id}", response_model=ResponseEnvelope[UserRead])
async def get_user_by_id(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Client viewers can only view their own user profile
    if current_user.role and current_user.role.name in (UserRoleEnum.CLIENT, UserRoleEnum.CLIENT_VIEWER) and user_id != current_user.id:
        raise ForbiddenException(detail="Clients can only view their own user profile")

    stmt = select(User).options(
        selectinload(User.role),
        selectinload(User.organization)
    ).where(User.id == user_id, User.is_deleted == False)
    
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise NotFoundException(detail="User not found")

    return ResponseEnvelope(
        success=True,
        data=UserRead.model_validate(user)
    )


@router.put("/{user_id}", response_model=ResponseEnvelope[UserRead])
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES))
):
    stmt = select(User).options(
        selectinload(User.role),
        selectinload(User.organization)
    ).where(User.id == user_id, User.is_deleted == False)
    
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise NotFoundException(detail="User not found")

    if payload.first_name is not None:
        user.first_name = payload.first_name
    if payload.last_name is not None:
        user.last_name = payload.last_name
    if payload.phone_number is not None:
        user.phone_number = payload.phone_number
    if payload.job_title is not None:
        user.job_title = payload.job_title
    if payload.is_active is not None:
        user.is_active = payload.is_active

    user.updated_by_id = current_user.id
    await db.commit()
    await db.refresh(user)

    return ResponseEnvelope(
        success=True,
        message="User updated successfully",
        data=UserRead.model_validate(user)
    )


@router.delete("/{user_id}", response_model=ResponseEnvelope[dict])
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES))
):
    if user_id == current_user.id:
        raise ForbiddenException(detail="Cannot delete your own administrator account")

    stmt = select(User).options(selectinload(User.role)).where(User.id == user_id, User.is_deleted == False)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise NotFoundException(detail="User not found")

    # Cannot delete Super Admin unless caller is Super Admin
    if user.role and user.role.name == UserRoleEnum.SUPER_ADMIN and current_user.role.name != UserRoleEnum.SUPER_ADMIN:
        raise ForbiddenException(detail="Admin users cannot delete Super Admin accounts")

    user.soft_delete(user_id=current_user.id)
    await db.commit()

    # Remove the deleted user's chat from live clients in real time
    try:
        from app.services.chat_ws_manager import chat_manager
        await chat_manager.broadcast_event(
            "user_deleted",
            {"user_id": str(user.id), "deleted_by": str(current_user.id)},
        )
    except Exception:
        pass

    return ResponseEnvelope(
        success=True,
        message="User account soft-deleted successfully",
        data={"deleted": True}
    )
