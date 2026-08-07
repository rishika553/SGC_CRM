import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
    UploadFile,
    File,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, and_, desc, asc

from app.core.database import get_db, AsyncSessionLocal
from app.core.security import decode_token
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException, CRMException
from app.api.deps import get_current_user, require_roles, ALL_ROLES
from app.models.chat import Conversation, ChatMessage, MessageTypeEnum
from app.models.user import User
from app.schemas.common import ResponseEnvelope, PaginatedResponse, PaginationMeta
from app.schemas.chat import (
    ChatMessageRead,
    ChatMessageCreate,
    ConversationRead,
    ChatAttachmentResponse,
)
from app.services.chat_ws_manager import chat_manager

router = APIRouter()

CHAT_ATTACHMENTS_DIR = os.path.join(os.getcwd(), "uploads", "chat")
os.makedirs(CHAT_ATTACHMENTS_DIR, exist_ok=True)


async def get_or_create_conversation(db: AsyncSession, user1_id: UUID, user2_id: UUID) -> Conversation:
    """
    Finds or creates a unique one-to-one conversation between user1 and user2.
    """
    u1, u2 = (user1_id, user2_id) if user1_id < user2_id else (user2_id, user1_id)

    stmt = select(Conversation).where(Conversation.user1_id == u1, Conversation.user2_id == u2)
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()

    if not conv:
        conv = Conversation(
            user1_id=u1,
            user2_id=u2,
            last_message_at=datetime.now(timezone.utc),
            created_by_id=user1_id,
            updated_by_id=user1_id,
        )
        db.add(conv)
        await db.commit()
        await db.refresh(conv)

    return conv


@router.websocket("/ws")
async def chat_websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    FastAPI WebSocket endpoint for real-time one-to-one chat, typing indicators, read receipts, and online status.
    """
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = decode_token(token)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    if not payload or "sub" not in payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id_str = payload["sub"]

    await chat_manager.connect(user_id_str, websocket)

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                msg_json = json.loads(raw_data)
                event_type = msg_json.get("event")
                event_data = msg_json.get("data", {})

                if event_type in ("typing_start", "typing_stop"):
                    recipient_id = event_data.get("recipient_id")
                    if recipient_id:
                        await chat_manager.send_personal_event(
                            user_id=str(recipient_id),
                            event_type=event_type,
                            payload={"sender_id": user_id_str}
                        )

                elif event_type == "message_read":
                    conversation_id = event_data.get("conversation_id")
                    sender_id = event_data.get("sender_id")
                    if sender_id:
                        await chat_manager.send_personal_event(
                            user_id=str(sender_id),
                            event_type="messages_read",
                            payload={
                                "conversation_id": conversation_id,
                                "read_by_user_id": user_id_str,
                                "read_at": datetime.now(timezone.utc).isoformat()
                            }
                        )

                elif event_type == "ping":
                    await websocket.send_text(json.dumps({"event": "pong", "data": {}}))

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        chat_manager.disconnect(user_id_str, websocket)
        await chat_manager.broadcast_user_status(user_id_str, is_online=False)


@router.get("/conversations", response_model=ResponseEnvelope[List[ConversationRead]])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all active one-to-one conversations for current user with recipient info, last message, unread count, online status.
    """
    stmt = select(Conversation).options(
        selectinload(Conversation.user1).selectinload(User.role),
        selectinload(Conversation.user2).selectinload(User.role),
    ).where(
        or_(Conversation.user1_id == current_user.id, Conversation.user2_id == current_user.id)
    ).order_by(desc(Conversation.last_message_at))

    res = await db.execute(stmt)
    conversations = res.scalars().all()

    results = []
    for conv in conversations:
        other_user = conv.user2 if conv.user1_id == current_user.id else conv.user1

        # Fetch last message
        stmt_last = select(ChatMessage).options(
            selectinload(ChatMessage.sender).selectinload(User.role),
            selectinload(ChatMessage.recipient).selectinload(User.role),
        ).where(
            ChatMessage.conversation_id == conv.id,
            ChatMessage.is_deleted == False
        ).order_by(desc(ChatMessage.created_at)).limit(1)

        res_last = await db.execute(stmt_last)
        last_msg = res_last.scalar_one_or_none()

        # Count unread messages for current user in this conversation
        stmt_unread = select(func.count()).where(
            ChatMessage.conversation_id == conv.id,
            ChatMessage.recipient_id == current_user.id,
            ChatMessage.is_read == False,
            ChatMessage.is_deleted == False
        )
        res_unread = await db.execute(stmt_unread)
        unread_count = res_unread.scalar_one()

        conv_read = ConversationRead.model_validate(conv)
        conv_read.other_user = other_user
        conv_read.last_message = ChatMessageRead.model_validate(last_msg) if last_msg else None
        conv_read.unread_count = unread_count
        conv_read.is_online = chat_manager.is_user_online(str(other_user.id))

        results.append(conv_read)

    return ResponseEnvelope(success=True, data=results)


@router.get("/messages/{other_user_id}", response_model=PaginatedResponse[ChatMessageRead])
async def get_chat_history(
    other_user_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get paginated message history between current user and other_user_id. Automatically marks unread messages as read.
    """
    conv = await get_or_create_conversation(db, current_user.id, other_user_id)

    # Bulk mark unread messages from other_user_id as read
    stmt_mark = select(ChatMessage).where(
        ChatMessage.conversation_id == conv.id,
        ChatMessage.recipient_id == current_user.id,
        ChatMessage.is_read == False,
        ChatMessage.is_deleted == False
    )
    res_mark = await db.execute(stmt_mark)
    unread_msgs = res_mark.scalars().all()

    if unread_msgs:
        now = datetime.now(timezone.utc)
        for msg in unread_msgs:
            msg.is_read = True
            msg.read_at = now
        await db.commit()

        # Broadcast WebSocket event to other user
        await chat_manager.send_personal_event(
            user_id=str(other_user_id),
            event_type="messages_read",
            payload={
                "conversation_id": str(conv.id),
                "read_by_user_id": str(current_user.id),
                "read_at": now.isoformat()
            }
        )

    # Query messages
    base_query = select(ChatMessage).where(
        ChatMessage.conversation_id == conv.id,
        ChatMessage.is_deleted == False
    )

    count_query = select(func.count()).select_from(base_query.subquery())
    total_res = await db.execute(count_query)
    total = total_res.scalar_one()

    query = base_query.options(
        selectinload(ChatMessage.sender).selectinload(User.role),
        selectinload(ChatMessage.recipient).selectinload(User.role),
    )
    offset = (page - 1) * page_size
    query = query.order_by(desc(ChatMessage.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    messages = list(reversed(result.scalars().all()))

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return PaginatedResponse(
        success=True,
        data=[ChatMessageRead.model_validate(m) for m in messages],
        meta=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_previous=page > 1,
        )
    )


@router.post("/messages", response_model=ResponseEnvelope[ChatMessageRead], status_code=status.HTTP_201_CREATED)
async def send_chat_message(
    payload: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a message (text or file attachment) and broadcast via WebSocket to recipient.
    """
    if payload.recipient_id == current_user.id:
        raise CRMException(status_code=400, detail="Cannot send message to yourself")

    stmt_rec = select(User).where(User.id == payload.recipient_id, User.is_active == True)
    res_rec = await db.execute(stmt_rec)
    recipient = res_rec.scalar_one_or_none()
    if not recipient:
        raise NotFoundException(detail="Recipient user not found or inactive")

    conv = await get_or_create_conversation(db, current_user.id, payload.recipient_id)

    now = datetime.now(timezone.utc)
    conv.last_message_at = now

    new_msg = ChatMessage(
        conversation_id=conv.id,
        sender_id=current_user.id,
        recipient_id=payload.recipient_id,
        message_type=payload.message_type,
        content=payload.content,
        attachment_url=payload.attachment_url,
        attachment_name=payload.attachment_name,
        attachment_type=payload.attachment_type,
        attachment_size=payload.attachment_size,
        is_read=False,
        created_by_id=current_user.id,
        updated_by_id=current_user.id,
    )
    db.add(new_msg)
    await db.commit()

    stmt_fetch = select(ChatMessage).options(
        selectinload(ChatMessage.sender).selectinload(User.role),
        selectinload(ChatMessage.recipient).selectinload(User.role),
    ).where(ChatMessage.id == new_msg.id)
    res_fetch = await db.execute(stmt_fetch)
    msg_created = res_fetch.scalar_one()

    msg_read = ChatMessageRead.model_validate(msg_created)
    msg_dict = msg_read.model_dump(mode="json")

    # Real-time WebSocket broadcast to recipient & sender tabs
    await chat_manager.send_personal_event(
        user_id=str(payload.recipient_id),
        event_type="new_message",
        payload=msg_dict
    )
    await chat_manager.send_personal_event(
        user_id=str(current_user.id),
        event_type="new_message",
        payload=msg_dict
    )

    return ResponseEnvelope(
        success=True,
        message="Message sent successfully",
        data=msg_read
    )


@router.post("/attachments", response_model=ResponseEnvelope[ChatAttachmentResponse])
async def upload_chat_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a chat file attachment (image, pdf, document).
    """
    filename = file.filename or "attachment.bin"
    mime = file.content_type or "application/octet-stream"

    content = await file.read()
    file_size = len(content)

    if file_size > 15 * 1024 * 1024:  # 15 MB limit
        raise CRMException(status_code=400, detail="Attachment size exceeds maximum limit of 15 MB")

    unique_name = f"{uuid.uuid4().hex}_{filename}"
    file_path = os.path.join(CHAT_ATTACHMENTS_DIR, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    attachment_url = f"/api/v1/documents/stream-file?path={file_path}"

    return ResponseEnvelope(
        success=True,
        data=ChatAttachmentResponse(
            attachment_url=attachment_url,
            attachment_name=filename,
            attachment_type=mime,
            attachment_size=file_size,
        )
    )


@router.post("/mark-read/{other_user_id}", response_model=ResponseEnvelope[dict])
async def mark_messages_read(
    other_user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark all unread messages from other_user_id as read.
    """
    conv = await get_or_create_conversation(db, current_user.id, other_user_id)

    stmt = select(ChatMessage).where(
        ChatMessage.conversation_id == conv.id,
        ChatMessage.recipient_id == current_user.id,
        ChatMessage.is_read == False,
        ChatMessage.is_deleted == False
    )
    res = await db.execute(stmt)
    messages = res.scalars().all()

    now = datetime.now(timezone.utc)
    for msg in messages:
        msg.is_read = True
        msg.read_at = now

    await db.commit()

    if messages:
        await chat_manager.send_personal_event(
            user_id=str(other_user_id),
            event_type="messages_read",
            payload={
                "conversation_id": str(conv.id),
                "read_by_user_id": str(current_user.id),
                "read_at": now.isoformat()
            }
        )

    return ResponseEnvelope(
        success=True,
        message=f"Marked {len(messages)} messages as read",
        data={"marked_count": len(messages)}
    )


@router.get("/unread-count", response_model=ResponseEnvelope[dict])
async def get_total_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get global unread messages count for current user.
    """
    stmt = select(func.count()).where(
        ChatMessage.recipient_id == current_user.id,
        ChatMessage.is_read == False,
        ChatMessage.is_deleted == False
    )
    res = await db.execute(stmt)
    total_unread = res.scalar_one()

    return ResponseEnvelope(
        success=True,
        data={"unread_count": total_unread}
    )


@router.delete("/messages/{message_id}", response_model=ResponseEnvelope[dict])
async def delete_chat_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Soft delete a chat message.
    """
    stmt = select(ChatMessage).where(ChatMessage.id == message_id, ChatMessage.is_deleted == False)
    res = await db.execute(stmt)
    msg = res.scalar_one_or_none()

    if not msg:
        raise NotFoundException(detail="Chat message not found")

    if msg.sender_id != current_user.id and current_user.role.name not in (UserRoleEnum.SUPER_ADMIN,):
        raise ForbiddenException(detail="You can only delete your own messages")

    msg.soft_delete(user_id=current_user.id)
    await db.commit()

    return ResponseEnvelope(
        success=True,
        message="Chat message deleted",
        data={"deleted": True, "message_id": str(message_id)}
    )
