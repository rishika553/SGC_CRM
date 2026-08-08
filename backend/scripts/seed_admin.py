
import asyncio
import sys
import os

# Add backend root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy.future import select
from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.role import Role, UserRoleEnum
from app.models.user import User


async def seed():
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding system roles...")

        roles_def = [
            (UserRoleEnum.SUPER_ADMIN, "Super Administrator", "Full system administration and global access"),
            (UserRoleEnum.CLIENT, "Client", "Client portal access to assigned agreements, projects, documents, and 1-on-1 chat"),
            (UserRoleEnum.CLIENT_VIEWER, "Client Viewer", "Client portal access for stakeholders"),
        ]

        roles_map = {}
        for role_name, display_name, description in roles_def:
            stmt = select(Role).where(Role.name == role_name)
            res = await db.execute(stmt)
            role = res.scalar_one_or_none()

            if not role:
                role = Role(
                    name=role_name,
                    display_name=display_name,
                    description=description
                )
                db.add(role)
                await db.flush()
                print(f"  + Created role: {display_name}")
            roles_map[role_name] = role

        # Check if Admin user exists
        stmt_user = select(User).where(User.email == "admin@sgccrm.com")
        res_user = await db.execute(stmt_user)
        existing_admin = res_user.scalar_one_or_none()

        if not existing_admin:
            admin_user = User(
                email="admin@sgccrm.com",
                hashed_password=get_password_hash("Password123!"),
                first_name="Managing",
                last_name="Director",
                job_title="Managing Director & Founder",
                phone_number="+1 (555) 019-2834",
                role_id=roles_map[UserRoleEnum.SUPER_ADMIN].id,
                is_active=True,
                is_verified=True,
            )
            db.add(admin_user)
            print("👑 Created default Admin account: admin@sgccrm.com / Password123!")
        else:
            print("ℹ️ Admin account already exists: admin@sgccrm.com")

        # Check if rishikaaa02@gmail.com user exists
        stmt_user2 = select(User).where(User.email == "rishikaaa02@gmail.com")
        res_user2 = await db.execute(stmt_user2)
        existing_user2 = res_user2.scalar_one_or_none()

        if not existing_user2:
            user2 = User(
                email="rishikaaa02@gmail.com",
                hashed_password=get_password_hash("Password123!"),
                first_name="Rishika",
                last_name="Admin",
                job_title="System Administrator",
                phone_number="+1 (555) 019-2835",
                role_id=roles_map[UserRoleEnum.SUPER_ADMIN].id,
                is_active=True,
                is_verified=True,
            )
            db.add(user2)
            print("👑 Created account: rishikaaa02@gmail.com / Password123!")
        else:
            # Ensure password is standard Password123! and active
            existing_user2.hashed_password = get_password_hash("Password123!")
            existing_user2.is_active = True
            existing_user2.is_verified = True
            print("ℹ️ Updated account password for: rishikaaa02@gmail.com / Password123!")

        # Seed default demo Client organization & user account
        from app.models.clients import Client, ClientStatusEnum, ClientTierEnum
        stmt_client_org = select(Client).where(Client.name == "Acme Advisory Group")
        res_client_org = await db.execute(stmt_client_org)
        client_org = res_client_org.scalar_one_or_none()

        if not client_org:
            client_org = Client(
                name="Acme Advisory Group",
                legal_name="Acme Advisory Group Pvt Ltd",
                industry="Financial Consulting & Advisory",
                primary_contact_name="Sarah Jenkins",
                email="client@sgccrm.com",
                phone="+1 (555) 234-5678",
                city="San Francisco",
                state="CA",
                country="USA",
                tier=ClientTierEnum.ENTERPRISE,
                status=ClientStatusEnum.ACTIVE,
            )
            db.add(client_org)
            await db.flush()
            print("🏢 Created default Client organization: Acme Advisory Group")

        stmt_client_user = select(User).where(User.email == "client@sgccrm.com")
        res_client_user = await db.execute(stmt_client_user)
        existing_client_user = res_client_user.scalar_one_or_none()

        if not existing_client_user:
            client_user = User(
                email="client@sgccrm.com",
                hashed_password=get_password_hash("Password123!"),
                first_name="Sarah",
                last_name="Jenkins",
                job_title="VP of Operations",
                phone_number="+1 (555) 234-5678",
                organization_id=None,
                role_id=roles_map[UserRoleEnum.CLIENT].id,
                is_active=True,
                is_verified=True,
            )
            db.add(client_user)
            print("💼 Created default Client account: client@sgccrm.com / Password123!")
        else:
            existing_client_user.hashed_password = get_password_hash("Password123!")
            existing_client_user.organization_id = None
            existing_client_user.role_id = roles_map[UserRoleEnum.CLIENT].id
            existing_client_user.is_active = True
            existing_client_user.is_verified = True
            print("ℹ️ Updated Client account credentials for: client@sgccrm.com / Password123!")

        await db.commit()
        print("✅ Database seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
