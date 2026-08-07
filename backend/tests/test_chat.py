import uuid
from datetime import datetime, timezone
import pytest
from app.models.chat import MessageTypeEnum
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageRead,
    ConversationRead,
    ChatAttachmentResponse,
)
from app.services.chat_ws_manager import ChatConnectionManager


def test_chat_enums():
    assert MessageTypeEnum.TEXT.value == "text"
    assert MessageTypeEnum.FILE.value == "file"
    assert MessageTypeEnum.IMAGE.value == "image"
    assert MessageTypeEnum.AUDIO.value == "audio"


def test_chat_message_create_schema():
    recipient_id = uuid.uuid4()
    msg = ChatMessageCreate(
        recipient_id=recipient_id,
        content="Hello, please review the project proposal.",
        message_type=MessageTypeEnum.TEXT,
    )
    assert msg.recipient_id == recipient_id
    assert msg.content == "Hello, please review the project proposal."


def test_chat_attachment_response_schema():
    att = ChatAttachmentResponse(
        attachment_url="/api/v1/documents/stream-file?path=uploads/chat/sample.pdf",
        attachment_name="Project_Brief.pdf",
        attachment_type="application/pdf",
        attachment_size=1048576,
    )
    assert att.attachment_name == "Project_Brief.pdf"
    assert att.attachment_size == 1048576


def test_ws_connection_manager_online_status():
    manager = ChatConnectionManager()
    user_id = str(uuid.uuid4())

    assert manager.is_user_online(user_id) is False
    assert len(manager.get_online_users()) == 0
