from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, desc, asc

from app.core.database import get_db
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException
from app.core.security import get_password_hash
from app.api.deps import get_current_user, require_roles, ADMIN_ROLES, SUPER_ADMIN_ROLES, ALL_ROLES
from app.models.clients import Client, ClientTierEnum, ClientStatusEnum
from app.models.projects import Project
from app.models.tasks import Task
from app.models.audit import AuditLog
from app.models.role import Role, UserRoleEnum
from app.models.user import User
from app.schemas.common import ResponseEnvelope, PaginatedResponse, PaginationMeta, build_paginated_response
from app.schemas.clients import (
    ClientRead,
    ClientDetailRead,
    ClientCreate,
    ClientUpdate,
    ProvisionClientAccountRequest,
    ProvisionClientAccountResponse,
)
from app.schemas.user import UserRead
from app.schemas.audit import AuditLogRead
from app.repositories import client_repository
from app.services.audit_service import log_audit_event

router = APIRouter()


def client_options_loader():
    return [
        selectinload(Client.assigned_admin).selectinload(User.role),
        selectinload(Client.account_manager).selectinload(User.role),
        selectinload(Client.contacts),
    ]


@router.get("/me", response_model=ResponseEnvelope[ClientRead])
async def get_my_client_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.api.deps import get_user_client_id
    client_id = await get_user_client_id(current_user, db)
    if not client_id:
        # Create a dedicated Client record for this client user
        new_client = Client(
            name=f"{current_user.first_name} {current_user.last_name} Company",
            primary_contact_name=f"{current_user.first_name} {current_user.last_name}",
            email=current_user.email,
            status=ClientStatusEnum.ACTIVE,
            created_by_id=current_user.id,
        )
        db.add(new_client)
        await db.commit()
        client_id = new_client.id

    stmt = select(Client).options(*client_options_loader()).where(Client.id == client_id, Client.is_deleted == False)
    res = await db.execute(stmt)
    client_obj = res.scalar_one_or_none()

    if not client_obj:
        raise NotFoundException(detail="Client profile not found")

    return ResponseEnvelope(
        success=True,
        data=ClientRead.model_validate(client_obj)
    )


@router.get("", response_model=PaginatedResponse[ClientRead])
async def list_clients(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    search: Optional[str] = Query(None, description="Search query across name, legal name, GST, PAN, email, phone, city, state"),
    tier: Optional[ClientTierEnum] = Query(None, description="Filter by client tier"),
    status_filter: Optional[ClientStatusEnum] = Query(None, alias="status", description="Filter by status"),
    assigned_admin_id: Optional[UUID] = Query(None, description="Filter by assigned admin user ID"),
    state: Optional[str] = Query(None, description="Filter by state"),
    industry: Optional[str] = Query(None, description="Filter by industry"),
    include_deleted: bool = Query(False, description="Include soft-deleted profiles"),
    only_deleted: bool = Query(False, description="Show only soft-deleted profiles"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort direction: asc or desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role and current_user.role.name in (UserRoleEnum.CLIENT, UserRoleEnum.CLIENT_VIEWER):
        raise ForbiddenException(detail="Client users cannot access the client directory")
    clients, total = await client_repository.list_clients_paginated(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        tier=tier,
        status_filter=status_filter,
        assigned_admin_id=assigned_admin_id,
        state=state,
        industry=industry,
        include_deleted=include_deleted,
        only_deleted=only_deleted,
        sort_by=sort_by,
        sort_order=sort_order,
    )

    return build_paginated_response(
        items=[ClientRead.model_validate(c) for c in clients],
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("", response_model=ResponseEnvelope[ClientRead], status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    assigned_admin_id = payload.assigned_admin_id or payload.account_manager_id or current_user.id

    new_client = Client(
        name=payload.name,
        legal_name=payload.legal_name,
        company_type=payload.company_type,
        industry=payload.industry,
        company_size=payload.company_size,
        website=payload.website,
        annual_revenue=payload.annual_revenue,
        currency=payload.currency or "INR",
        gst_number=payload.gst_number,
        pan_number=payload.pan_number,
        primary_contact_name=payload.primary_contact_name,
        email=payload.email,
        phone=payload.phone,
        address_line1=payload.address_line1,
        address_line2=payload.address_line2,
        city=payload.city,
        state=payload.state,
        postal_code=payload.postal_code,
        country=payload.country or "India",
        billing_address=payload.billing_address,
        tier=payload.tier,
        status=payload.status,
        assigned_admin_id=assigned_admin_id,
        account_manager_id=assigned_admin_id,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(new_client)
    await db.commit()

    # Log Audit Event
    client_dict = {
        "name": new_client.name,
        "legal_name": new_client.legal_name,
        "gst_number": new_client.gst_number,
        "pan_number": new_client.pan_number,
        "status": new_client.status.value if new_client.status else None,
    }
    await log_audit_event(
        db=db,
        action="CLIENT_CREATED",
        entity_name="Client",
        entity_id=str(new_client.id),
        changes={"created": client_dict},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    # Fetch created object with relationships
    stmt = select(Client).options(*client_options_loader()).where(Client.id == new_client.id)
    res = await db.execute(stmt)
    client_created = res.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Client profile created successfully",
        data=ClientRead.model_validate(client_created)
    )


@router.get("/{client_id}", response_model=ResponseEnvelope[ClientDetailRead])
async def get_client_by_id(
    client_id: UUID,
    include_deleted: bool = Query(False, description="Include if soft-deleted"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role and current_user.role.name in (UserRoleEnum.CLIENT, UserRoleEnum.CLIENT_VIEWER):
        if current_user.organization_id and current_user.organization_id != client_id:
            raise ForbiddenException(detail="You do not have permission to view another client's profile.")

    loader = client_options_loader() + [
        selectinload(Client.communication_logs).selectinload(Client.communication_logs.property.mapper.class_.logged_by).selectinload(User.role),
        selectinload(Client.communication_logs).selectinload(Client.communication_logs.property.mapper.class_.contact)
    ]
    stmt = select(Client).options(*loader).where(Client.id == client_id)
    if not include_deleted:
        stmt = stmt.where(Client.is_deleted == False)

    res = await db.execute(stmt)
    client = res.scalar_one_or_none()

    if not client:
        raise NotFoundException(detail="Client profile not found")

    return ResponseEnvelope(
        success=True,
        data=ClientDetailRead.model_validate(client)
    )


@router.put("/{client_id}", response_model=ResponseEnvelope[ClientRead])
@router.patch("/{client_id}", response_model=ResponseEnvelope[ClientRead])
async def update_client(
    client_id: UUID,
    payload: ClientUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Client).options(*client_options_loader()).where(Client.id == client_id, Client.is_deleted == False)
    res = await db.execute(stmt)
    client = res.scalar_one_or_none()

    if not client:
        raise NotFoundException(detail="Client profile not found")

    changes = {}
    update_data = payload.model_dump(exclude_unset=True)

    for field, new_val in update_data.items():
        if hasattr(client, field):
            old_val = getattr(client, field)
            # Serialize enums or UUIDs for audit diff
            old_str = old_val.value if hasattr(old_val, "value") else (str(old_val) if isinstance(old_val, UUID) else old_val)
            new_str = new_val.value if hasattr(new_val, "value") else (str(new_val) if isinstance(new_val, UUID) else new_val)

            if old_str != new_str:
                changes[field] = {"old": old_str, "new": new_str}
                setattr(client, field, new_val)

    # Sync account_manager_id if assigned_admin_id changes
    if "assigned_admin_id" in update_data and update_data["assigned_admin_id"] is not None:
        client.account_manager_id = update_data["assigned_admin_id"]

    if changes:
        client.updated_by_id = current_user.id
        await log_audit_event(
            db=db,
            action="CLIENT_UPDATED",
            entity_name="Client",
            entity_id=str(client.id),
            changes=changes,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        await db.refresh(client)

    return ResponseEnvelope(
        success=True,
        message="Client profile updated successfully",
        data=ClientRead.model_validate(client)
    )


@router.delete("/{client_id}", response_model=ResponseEnvelope[dict])
async def delete_client(
    client_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES))
):
    stmt = select(Client).where(Client.id == client_id, Client.is_deleted == False)
    res = await db.execute(stmt)
    client = res.scalar_one_or_none()

    if not client:
        raise NotFoundException(detail="Client profile not found")

    client.soft_delete(user_id=current_user.id)

    # Cascading soft-delete for associated Projects
    stmt_projects = select(Project).where(Project.client_id == client_id, Project.is_deleted == False)
    res_projects = await db.execute(stmt_projects)
    for proj in res_projects.scalars().all():
        proj.soft_delete(user_id=current_user.id)

    # Cascading soft-delete for associated Tasks
    stmt_tasks = select(Task).where(Task.client_id == client_id, Task.is_deleted == False)
    res_tasks = await db.execute(stmt_tasks)
    for task in res_tasks.scalars().all():
        task.soft_delete(user_id=current_user.id)

    # Cascading soft-delete for client portal user accounts (linked via contact email)
    from app.models.clients import Contact
    stmt_contacts = select(Contact).where(Contact.client_id == client_id)
    res_contacts = await db.execute(stmt_contacts)
    client_emails = {client.email} | {c.email.lower() for c in res_contacts.scalars().all() if c.email}
    client_emails.discard(None)

    deleted_user_ids: list[str] = []
    if client_emails:
        stmt_users = select(User).where(
            func.lower(User.email).in_([e.lower() for e in client_emails if e]),
            User.is_deleted == False,
        )
        res_users = await db.execute(stmt_users)
        for user in res_users.scalars().all():
            if user.role and user.role.name in (UserRoleEnum.CLIENT, UserRoleEnum.CLIENT_VIEWER):
                user.soft_delete(user_id=current_user.id)
                deleted_user_ids.append(str(user.id))

    await log_audit_event(
        db=db,
        action="CLIENT_SOFT_DELETED",
        entity_name="Client",
        entity_id=str(client.id),
        changes={
            "is_deleted": {"old": False, "new": True},
            "deleted_user_accounts": deleted_user_ids,
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    # Remove the deleted client users from live chat windows in real time
    if deleted_user_ids:
        try:
            from app.services.chat_ws_manager import chat_manager
            for user_id in deleted_user_ids:
                await chat_manager.broadcast_event(
                    "user_deleted",
                    {"user_id": user_id, "deleted_by": str(current_user.id)},
                )
        except Exception:
            pass

    return ResponseEnvelope(
        success=True,
        message="Client profile soft-deleted successfully",
        data={"deleted": True, "id": str(client_id)}
    )


@router.post("/{client_id}/restore", response_model=ResponseEnvelope[ClientRead])
async def restore_client(
    client_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES))
):
    stmt = select(Client).options(*client_options_loader()).where(Client.id == client_id, Client.is_deleted == True)
    res = await db.execute(stmt)
    client = res.scalar_one_or_none()

    if not client:
        raise NotFoundException(detail="Soft-deleted client profile not found")

    client.restore()
    client.updated_by_id = current_user.id
    await log_audit_event(
        db=db,
        action="CLIENT_RESTORED",
        entity_name="Client",
        entity_id=str(client.id),
        changes={"is_deleted": {"old": True, "new": False}},
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    await db.refresh(client)

    return ResponseEnvelope(
        success=True,
        message="Client profile restored successfully",
        data=ClientRead.model_validate(client)
    )


@router.get("/{client_id}/audit-logs", response_model=PaginatedResponse[AuditLogRead])
async def get_client_audit_logs(
    client_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify client exists
    stmt_client = select(Client).where(Client.id == client_id)
    res_client = await db.execute(stmt_client)
    if not res_client.scalar_one_or_none():
        raise NotFoundException(detail="Client profile not found")

    query = select(AuditLog).options(
        selectinload(AuditLog.user).selectinload(User.role)
    ).where(
        AuditLog.entity_name == "Client",
        AuditLog.entity_id == str(client_id)
    )

    count_query = select(func.count()).select_from(query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    offset = (page - 1) * page_size
    query = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    audit_logs = result.scalars().all()

    return build_paginated_response(
        items=[AuditLogRead.model_validate(log) for log in audit_logs],
        total=total,
        page=page,
        page_size=page_size
    )


@router.post("/provision-account", response_model=ResponseEnvelope[ProvisionClientAccountResponse], status_code=status.HTTP_201_CREATED)
async def provision_client_account(
    payload: ProvisionClientAccountRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES))
):
    clean_username = payload.username_or_email.strip().lower()
    stmt_user = select(User).where(func.lower(User.email) == clean_username, User.is_deleted == False)
    res_user = await db.execute(stmt_user)
    if res_user.scalar_one_or_none():
        raise ConflictException(detail=f"User account with login username/email '{payload.username_or_email}' already exists")

    # Get client role
    stmt_role = select(Role).where(Role.name.in_([UserRoleEnum.CLIENT_VIEWER, UserRoleEnum.CLIENT]))
    res_role = await db.execute(stmt_role)
    roles = res_role.scalars().all()
    client_role = next((r for r in roles if r.name == UserRoleEnum.CLIENT_VIEWER or r.name == UserRoleEnum.CLIENT), None)

    if not client_role:
        client_role = Role(
            name=UserRoleEnum.CLIENT_VIEWER,
            display_name="Client Stakeholder",
            description="Client portal user with view capabilities"
        )
        db.add(client_role)
        await db.flush()

    # Create or find client company
    stmt_client = select(Client).where(func.lower(Client.name) == payload.client_name.strip().lower(), Client.is_deleted == False)
    res_client = await db.execute(stmt_client)
    client_obj = res_client.scalar_one_or_none()

    if not client_obj:
        client_obj = Client(
            name=payload.client_name.strip(),
            industry=payload.industry,
            tier=payload.tier,
            status=ClientStatusEnum.ACTIVE,
            primary_contact_name=f"{payload.first_name.strip()} {payload.last_name.strip()}",
            email=payload.username_or_email.strip(),
            created_by_id=current_user.id,
        )
        db.add(client_obj)
        await db.flush()
    else:
        # Update existing client contact email & name if missing
        if not client_obj.email:
            client_obj.email = payload.username_or_email.strip()
        if not client_obj.primary_contact_name:
            client_obj.primary_contact_name = f"{payload.first_name.strip()} {payload.last_name.strip()}"

    # Check if contact already exists
    from app.models.clients import Contact
    stmt_contact = select(Contact).where(Contact.client_id == client_obj.id, Contact.email == payload.username_or_email.strip())
    res_contact = await db.execute(stmt_contact)
    if not res_contact.scalar_one_or_none():
        new_contact = Contact(
            client_id=client_obj.id,
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            email=payload.username_or_email.strip(),
            job_title=payload.job_title or "Client Stakeholder",
            is_primary_contact=True,
            created_by_id=current_user.id,
        )
        db.add(new_contact)

    # Create user credentials
    user_email = payload.username_or_email.strip()
    if "@" not in user_email:
        user_email = f"{user_email}@sgccrm.com"

    new_user = User(
        email=user_email,
        hashed_password=get_password_hash(payload.password),
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        job_title=payload.job_title or "Client Stakeholder",
        organization_id=None,
        role_id=client_role.id,
        is_active=True,
        is_verified=True,
        created_by_id=current_user.id,
    )
    db.add(new_user)
    await db.flush()

    # Sync to Supabase Auth schema (auth.users and auth.identities)
    from app.core.supabase_auth_sync import sync_user_to_supabase_auth
    await sync_user_to_supabase_auth(db, new_user.id, user_email, payload.password)

    await log_audit_event(
        db=db,
        action="CLIENT_ACCOUNT_PROVISIONED",
        entity_name="User",
        entity_id=str(new_user.id),
        changes={
            "client_name": client_obj.name,
            "username": new_user.email,
            "role": client_role.name,
        },
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()

    stmt_c = select(Client).options(*client_options_loader()).where(Client.id == client_obj.id)
    res_c = await db.execute(stmt_c)
    c_read = res_c.scalar_one()

    stmt_u = select(User).options(selectinload(User.role), selectinload(User.organization)).where(User.id == new_user.id)
    res_u = await db.execute(stmt_u)
    u_read = res_u.scalar_one()

    return ResponseEnvelope(
        success=True,
        message="Client portal account provisioned successfully",
        data=ProvisionClientAccountResponse(
            client=ClientRead.model_validate(c_read),
            user=UserRead.model_validate(u_read),
            login_username=new_user.email
        )
    )

