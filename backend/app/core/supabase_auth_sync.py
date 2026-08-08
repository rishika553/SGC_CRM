from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.security import get_password_hash


async def sync_user_to_supabase_auth(db: AsyncSession, user_id: UUID, email: str, password: str) -> str:
    clean_email = email.strip()
    if "@" not in clean_email:
        clean_email = f"{clean_email}@sgccrm.com"

    password_hash = get_password_hash(password)
    user_id_str = str(user_id)

    # 1. Upsert into auth.users
    sql_user = text("""
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, last_sign_in_at,
            raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at, is_anonymous,
            confirmation_token, recovery_token, email_change_token_new,
            email_change, phone_change, phone_change_token,
            reauthentication_token, email_change_token_current
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', :id, 'authenticated', 'authenticated',
            CAST(:email AS VARCHAR), :password_hash,
            NOW(), NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('sub', CAST(:id_str AS text), 'email', CAST(:email AS text), 'email_verified', true, 'phone_verified', false),
            NOW(), NOW(), false,
            '', '', '', '', '', '', '', ''
        )
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            encrypted_password = EXCLUDED.encrypted_password,
            email_confirmed_at = NOW(),
            updated_at = NOW();
    """)
    await db.execute(sql_user, {
        "id": user_id,
        "id_str": user_id_str,
        "email": clean_email,
        "password_hash": password_hash
    })

    # 2. Upsert into auth.identities
    sql_ident_check = text("SELECT id FROM auth.identities WHERE user_id = :id")
    res_ident = await db.execute(sql_ident_check, {"id": user_id})
    if not res_ident.scalar_one_or_none():
        sql_identity = text("""
            INSERT INTO auth.identities (
                id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), :id,
                jsonb_build_object('sub', CAST(:id_str AS text), 'email', CAST(:email AS text), 'email_verified', true, 'phone_verified', false),
                'email', CAST(:id_str AS text), NOW(), NOW(), NOW()
            );
        """)
        await db.execute(sql_identity, {"id": user_id, "id_str": user_id_str, "email": clean_email})

    return clean_email
