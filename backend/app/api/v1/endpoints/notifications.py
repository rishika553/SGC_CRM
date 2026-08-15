from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.api.deps import get_current_user
from app.core.exceptions import CRMException
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.schemas.common import ResponseEnvelope
from app.schemas.notifications import (
    PushSubscriptionCreate,
    PushSubscriptionRemove,
    PushConfigRead,
)
from app.services.push_service import push_notifications_enabled

router = APIRouter()


@router.get("/config", response_model=ResponseEnvelope[PushConfigRead])
async def get_push_config():
    """
    Public endpoint returning the VAPID public key the browser needs to
    subscribe for push notifications.
    """
    return ResponseEnvelope(
        success=True,
        data=PushConfigRead(
            enabled=push_notifications_enabled(),
            vapid_public_key=settings.VAPID_PUBLIC_KEY or "",
        ),
    )


@router.post("/subscribe", response_model=ResponseEnvelope[dict], status_code=status.HTTP_201_CREATED)
async def subscribe_to_push(
    payload: PushSubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Persist a browser push subscription for the authenticated user.
    Re-subscribing with the same endpoint updates the existing record.
    """
    if not push_notifications_enabled():
        raise CRMException(status_code=503, detail="Push notifications are not configured on this server.")

    stmt = select(PushSubscription).where(
        PushSubscription.endpoint == payload.endpoint,
        PushSubscription.is_deleted == False,
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing:
        existing.user_id = current_user.id
        existing.p256dh = payload.keys.p256dh
        existing.auth = payload.keys.auth
        if payload.user_agent:
            existing.user_agent = payload.user_agent
        existing.updated_by_id = current_user.id
    else:
        existing = PushSubscription(
            user_id=current_user.id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
            user_agent=payload.user_agent,
            created_by_id=current_user.id,
            updated_by_id=current_user.id,
        )
        db.add(existing)

    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Push subscription saved successfully",
        data={"subscribed": True},
    )


@router.post("/unsubscribe", response_model=ResponseEnvelope[dict])
async def unsubscribe_from_push(
    payload: PushSubscriptionRemove,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a push subscription (called on logout or when the user disables
    notifications in the browser).
    """
    stmt = select(PushSubscription).where(
        PushSubscription.endpoint == payload.endpoint,
        PushSubscription.is_deleted == False,
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()

    if existing:
        existing.soft_delete(user_id=current_user.id)
        await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Push subscription removed",
        data={"unsubscribed": True},
    )
