import asyncio
import json
import logging
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pywebpush import webpush, WebPushException

from app.core.config import settings
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)


def push_notifications_enabled() -> bool:
    """True when VAPID keys are configured so web push can be sent."""
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def _vapid_claims() -> Dict[str, str]:
    return {"sub": settings.VAPID_SUBJECT or "mailto:admin@sgccrm.com"}


def _send_single(subscription: PushSubscription, payload: Dict[str, Any]) -> bool:
    """
    Synchronously deliver a push notification to a single subscription.
    Returns True when delivered, False when the subscription is stale/gone.
    """
    try:
        response = webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh,
                    "auth": subscription.auth,
                },
            },
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims=_vapid_claims(),
            ttl=60 * 60 * 24,
        )
        if response.status_code >= 300:
            logger.warning("Push rejected for endpoint (status=%s)", response.status_code)
            return response.status_code in (404, 410)
        return True
    except WebPushException as exc:
        if exc.response is not None and exc.response.status_code in (404, 410):
            logger.info("Removing stale push subscription (404/410)")
            return False
        logger.warning("Web push delivery failed: %s", exc)
        return True  # transient failure, keep subscription


async def send_push_to_user(
    db: AsyncSession,
    user_id: UUID,
    title: str,
    body: str,
    url: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
) -> int:
    """
    Send a web push notification to every active subscription of `user_id`.
    Returns the number of successfully delivered pushes.
    """
    if not push_notifications_enabled():
        return 0

    stmt = select(PushSubscription).where(
        PushSubscription.user_id == user_id,
        PushSubscription.is_deleted == False,
    )
    res = await db.execute(stmt)
    subscriptions = res.scalars().all()

    if not subscriptions:
        return 0

    payload: Dict[str, Any] = {
        "title": title,
        "body": body,
        "url": url,
        **(data or {}),
    }

    stale: list[PushSubscription] = []
    delivered = 0

    for sub in subscriptions:
        ok = await asyncio.to_thread(_send_single, sub, payload)
        if not ok:
            stale.append(sub)
        else:
            delivered += 1

    for dead in stale:
        await db.delete(dead)

    if stale:
        try:
            await db.commit()
        except Exception as exc:  # pragma: no cover
            logger.warning("Failed to purge stale subscriptions: %s", exc)
            await db.rollback()

    return delivered


async def send_new_message_notification(
    db: AsyncSession,
    recipient_id: UUID,
    sender_name: str,
    content: str,
    message_id: UUID,
    conversation_id: UUID,
) -> int:
    """Convenience wrapper used by the chat module when the recipient is offline."""
    body = content or "[Attachment]"
    if len(body) > 140:
        body = body[:140] + "…"

    return await send_push_to_user(
        db=db,
        user_id=recipient_id,
        title=f"New message from {sender_name}",
        body=body,
        url="/client/chat",
        data={
            "type": "chat_message",
            "sender_id": str(recipient_id),
            "message_id": str(message_id),
            "conversation_id": str(conversation_id),
        },
    )
