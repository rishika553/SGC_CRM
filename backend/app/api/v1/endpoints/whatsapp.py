"""
WhatsApp Web Management — FastAPI Proxy
Routes all requests to the Node.js WhatsApp microservice (port 3001),
injecting the authenticated CRM user's ID as the session key.
"""
import urllib.request
import urllib.error
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query, status
from app.core.config import settings
from app.core.exceptions import CRMException, ServiceUnavailableException
from app.api.deps import require_roles, get_current_user, SUPER_ADMIN_ROLES
from app.models.user import User
from app.schemas.common import ResponseEnvelope

router = APIRouter()


def proxy_to_whatsapp_service(
    path: str,
    method: str = "GET",
    data: Optional[Dict[str, Any]] = None,
    crm_user_id: Optional[str] = None,
    query_params: Optional[Dict[str, str]] = None,
    timeout: int = 15,
) -> Dict[str, Any]:
    """Proxy a request to the Node.js WhatsApp microservice."""
    url = f"{settings.WHATSAPP_SERVICE_URL}{path}"

    # Append query params
    if query_params:
        qs = "&".join(f"{k}={v}" for k, v in query_params.items() if v is not None)
        url = f"{url}?{qs}" if qs else url

    headers = {
        "Content-Type": "application/json",
    }
    if crm_user_id:
        headers["x-crm-user-id"] = str(crm_user_id)

    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except urllib.error.HTTPError as ex:
        error_body = ex.read().decode("utf-8") if ex.fp else "{}"
        try:
            error_json = json.loads(error_body)
            detail = error_json.get("error", str(ex))
        except Exception:
            detail = str(ex)
        raise CRMException(status_code=ex.code, detail=str(detail))
    except urllib.error.URLError:
        raise ServiceUnavailableException(
            detail="WhatsApp Node.js microservice is unreachable. Ensure the service on port 3001 is running."
        )
    except Exception as ex:
        raise CRMException(status_code=500, detail=f"WhatsApp service error: {str(ex)}")


# ── Session Management ─────────────────────────────────────────────────────

@router.get("/status", response_model=ResponseEnvelope[dict])
async def get_whatsapp_status(
    current_user: User = Depends(get_current_user),
):
    """Get WhatsApp Web connection status for the authenticated CRM user."""
    res = proxy_to_whatsapp_service("/status", method="GET", crm_user_id=str(current_user.id))
    return ResponseEnvelope(success=True, data=res)


@router.get("/qr", response_model=ResponseEnvelope[dict])
async def get_whatsapp_qr(
    current_user: User = Depends(get_current_user),
):
    """Get the current WhatsApp QR code data URL for the authenticated CRM user."""
    res = proxy_to_whatsapp_service("/qr", method="GET", crm_user_id=str(current_user.id))
    return ResponseEnvelope(success=True, data=res)


@router.post("/connect", response_model=ResponseEnvelope[dict])
async def connect_whatsapp(
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    """Superadmin only: Initiate WhatsApp Web session and QR generation."""
    res = proxy_to_whatsapp_service("/connect", method="POST", crm_user_id=str(current_user.id))
    return ResponseEnvelope(success=True, data=res)


@router.post("/disconnect", response_model=ResponseEnvelope[dict])
async def disconnect_whatsapp(
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    """Superadmin only: Disconnect and destroy the WhatsApp Web session."""
    res = proxy_to_whatsapp_service("/disconnect", method="POST", crm_user_id=str(current_user.id))
    return ResponseEnvelope(success=True, data=res)


# ── Chat & Messaging ───────────────────────────────────────────────────────

@router.get("/chats", response_model=ResponseEnvelope[dict])
async def get_whatsapp_chats(
    limit: int = Query(50, ge=1, le=200, description="Max number of chats to return"),
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    """Superadmin only: Fetch WhatsApp chat list (sorted by most recent message)."""
    res = proxy_to_whatsapp_service(
        "/chats",
        method="GET",
        crm_user_id=str(current_user.id),
        query_params={"limit": str(limit)},
    )
    return ResponseEnvelope(success=True, data=res)


@router.get("/messages/{chat_id:path}", response_model=ResponseEnvelope[dict])
async def get_whatsapp_messages(
    chat_id: str,
    limit: int = Query(50, ge=1, le=200, description="Number of messages to load"),
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    """Superadmin only: Fetch message history for a specific WhatsApp chat."""
    import urllib.parse
    encoded_chat_id = urllib.parse.quote(chat_id, safe="")
    res = proxy_to_whatsapp_service(
        f"/messages/{encoded_chat_id}",
        method="GET",
        crm_user_id=str(current_user.id),
        query_params={"limit": str(limit)},
        timeout=20,
    )
    return ResponseEnvelope(success=True, data=res)


@router.post("/send", response_model=ResponseEnvelope[dict])
async def send_whatsapp_message(
    payload: dict,
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    """Superadmin only: Send a text message to a WhatsApp chat.
    
    Body: { chatId: str, message: str }
    """
    if not payload.get("chatId") or not payload.get("message"):
        raise CRMException(status_code=400, detail="chatId and message are required")
    res = proxy_to_whatsapp_service(
        "/send",
        method="POST",
        data={"chatId": payload["chatId"], "message": payload["message"]},
        crm_user_id=str(current_user.id),
        timeout=15,
    )
    return ResponseEnvelope(success=True, data=res)


@router.post("/send-media", response_model=ResponseEnvelope[dict])
async def send_whatsapp_media(
    payload: dict,
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    """Superadmin only: Send a media file (image/pdf/etc.) to a WhatsApp chat.
    
    Body: { chatId, mediaBase64, mimetype, filename?, caption? }
    """
    if not payload.get("chatId") or not payload.get("mediaBase64") or not payload.get("mimetype"):
        raise CRMException(status_code=400, detail="chatId, mediaBase64, and mimetype are required")
    res = proxy_to_whatsapp_service(
        "/send-media",
        method="POST",
        data=payload,
        crm_user_id=str(current_user.id),
        timeout=30,
    )
    return ResponseEnvelope(success=True, data=res)


@router.post("/mark-read/{chat_id:path}", response_model=ResponseEnvelope[dict])
async def mark_whatsapp_chat_read(
    chat_id: str,
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    """Superadmin only: Mark all messages in a WhatsApp chat as read."""
    import urllib.parse
    encoded_chat_id = urllib.parse.quote(chat_id, safe="")
    res = proxy_to_whatsapp_service(
        f"/mark-read/{encoded_chat_id}",
        method="POST",
        crm_user_id=str(current_user.id),
    )
    return ResponseEnvelope(success=True, data=res)


@router.get("/contact/{number}", response_model=ResponseEnvelope[dict])
async def check_whatsapp_contact(
    number: str,
    current_user: User = Depends(require_roles(SUPER_ADMIN_ROLES)),
):
    """Superadmin only: Check if a phone number is registered on WhatsApp."""
    res = proxy_to_whatsapp_service(
        f"/contact/{number}",
        method="GET",
        crm_user_id=str(current_user.id),
    )
    return ResponseEnvelope(success=True, data=res)


@router.get("/health", response_model=ResponseEnvelope[dict])
async def whatsapp_service_health(
    current_user: User = Depends(get_current_user),
):
    """Check if the WhatsApp Node.js microservice is reachable."""
    res = proxy_to_whatsapp_service("/health", method="GET")
    return ResponseEnvelope(success=True, data=res)
