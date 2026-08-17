import time
import uuid
from typing import List, Callable
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, text

from app.core.database import get_db
from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.models.user import User
from app.models.role import UserRoleEnum

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

SUPER_ADMIN_ROLES = [UserRoleEnum.SUPER_ADMIN]
ADMIN_ROLES = [UserRoleEnum.SUPER_ADMIN]
CLIENT_ROLES = [UserRoleEnum.CLIENT, UserRoleEnum.CLIENT_VIEWER]
ALL_ROLES = [UserRoleEnum.SUPER_ADMIN, UserRoleEnum.CLIENT, UserRoleEnum.CLIENT_VIEWER]


async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    t_start = time.perf_counter()
    # Temporary diagnostic: only instrument the /users/me request flow
    is_me = request.url.path.endswith("/users/me")

    if not token:
        raise UnauthorizedException(detail="Authentication token is missing")

    try:
        t_auth0 = time.perf_counter()
        payload = decode_token(token)
        t_auth1 = time.perf_counter()
        user_id_str = payload.get("sub")
        email = payload.get("email")
        if not user_id_str:
            raise UnauthorizedException(detail="Invalid token payload")
        user_id = uuid.UUID(user_id_str)
    except Exception:
        raise UnauthorizedException(detail="Could not validate credentials")

    if is_me:
        print(f"[ME] START")
        print(f"[ME] AUTH: {(t_auth1 - t_auth0) * 1000:.1f} ms")

    # Temporary diagnostic: measure DB connection acquisition (SELECT 1)
    if is_me:
        t_db0 = time.perf_counter()
        await db.execute(text("SELECT 1"))
        t_db1 = time.perf_counter()
        print(f"[ME] DB CONNECTION: {(t_db1 - t_db0) * 1000:.1f} ms")

    # Try lookup by ID or case-insensitive email
    conditions = [User.id == user_id]
    if email:
        conditions.append(func.lower(User.email) == email.lower())

    t_db2 = time.perf_counter()
    stmt = select(User).options(
        selectinload(User.role),
        selectinload(User.organization)
    ).where(or_(*conditions), User.is_deleted == False)
    
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    t_db3 = time.perf_counter()

    if is_me:
        # User query bucket also includes role + organization eager loads
        print(f"[ME] USER QUERY (incl ROLE/ORG): {(t_db3 - t_db2) * 1000:.1f} ms")

    if not user and email:
        # Auto-provision user from Supabase token info if user record is missing in public.users
        from app.models.role import Role, UserRoleEnum
        stmt_role = select(Role).where(Role.name == UserRoleEnum.SUPER_ADMIN)
        role_res = await db.execute(stmt_role)
        role = role_res.scalar_one_or_none()

        user = User(
            id=user_id,
            email=email,
            hashed_password="",
            first_name=payload.get("user_metadata", {}).get("first_name", "Supabase"),
            last_name=payload.get("user_metadata", {}).get("last_name", "User"),
            role_id=role.id if role else None,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        
        # Re-query to load relationships
        stmt_reload = select(User).options(
            selectinload(User.role),
            selectinload(User.organization)
        ).where(User.id == user.id)
        res_reload = await db.execute(stmt_reload)
        user = res_reload.scalar_one()

    if not user:
        raise UnauthorizedException(detail="User not found")
        
    if not user.is_active:
        raise ForbiddenException(detail="User account is inactive")

    # Normalize role name to lowercase so DB values like "SUPER_ADMIN"
    # match our UserRoleEnum values like "super_admin" in all comparisons.
    if user.role and user.role.name:
        user.role.name = user.role.name.lower()

    if is_me:
        print(f"[ME] AUTH DEP TOTAL: {(time.perf_counter() - t_start) * 1000:.1f} ms")

    return user


def require_roles(allowed_roles: List[UserRoleEnum]) -> Callable:
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if not current_user.role or current_user.role.name not in allowed_roles:
            raise ForbiddenException(
                detail=f"Action requires one of the following roles: {[r.value for r in allowed_roles]}"
            )
        return current_user

    return role_checker


async def get_user_client_id(user: User, db: AsyncSession) -> uuid.UUID | None:
    """
    Safely resolves the associated Client ID for a client user.
    Enforces strict backend-driven client isolation.
    """
    if not user or not user.email:
        return None

    from sqlalchemy import func, or_
    from app.models.role import Role
    from app.models.clients import Contact, Client

    # Portal accounts are provisioned with a bare username that is stored on the
    # client/contact (e.g. "testing") while the login email gets "@sgccrm.com"
    # appended (e.g. "testing@sgccrm.com"). Match on both forms.
    user_email = user.email.lower()
    username = user_email.split("@")[0] if "@" in user_email else user_email

    # Safely query role name without triggering lazy-load MissingGreenlet exception
    if user.role_id:
        stmt_role = select(Role.name).where(Role.id == user.role_id)
        res_role = await db.execute(stmt_role)
        role_name_val = res_role.scalar_one_or_none()
        role_str = role_name_val.value if hasattr(role_name_val, "value") else str(role_name_val or "")
        if role_str.lower() not in ("client", "client_viewer"):
            return None

    # 1. Match Contact email (exact email OR bare username; client must be active)
    stmt_contact = select(Contact.client_id).join(Client, Client.id == Contact.client_id).where(
        or_(func.lower(Contact.email) == user_email, func.lower(Contact.email) == username),
        Client.is_deleted == False,
    )
    res_contact = await db.execute(stmt_contact)
    contact_client_id = res_contact.scalar_one_or_none()
    if contact_client_id:
        return contact_client_id

    # 2. Match Client email, name, or created_by_id (exact email OR bare username; client must be active)
    stmt_client = select(Client.id).where(
        or_(
            func.lower(Client.email) == user_email,
            func.lower(Client.email) == username,
            func.lower(Client.name) == user_email,
            func.lower(Client.name) == username,
            Client.created_by_id == user.id,
        ),
        Client.is_deleted == False,
    )
    res_client = await db.execute(stmt_client)
    client_id = res_client.scalar_one_or_none()
    if client_id:
        return client_id

    return None

