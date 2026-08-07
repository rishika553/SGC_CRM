import uuid
from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from app.models.clients import Client, ClientTierEnum, ClientStatusEnum
from app.models.chat import Conversation
from app.schemas.clients import ClientCreate
from app.schemas.common import build_paginated_response, PaginatedResponse
from app.services.storage_service import generate_secure_signed_url


def test_soft_delete_and_timestamps():
    client = Client(
        name="Tech Solutions Ltd",
        email="contact@techsolutions.com",
        tier=ClientTierEnum.ENTERPRISE,
        status=ClientStatusEnum.ACTIVE,
        is_deleted=False,
    )

    assert client.is_deleted is False
    assert client.deleted_at is None

    now = datetime.now(timezone.utc)
    client.soft_delete(user_id=uuid.uuid4())

    assert client.is_deleted is True
    assert client.deleted_at is not None

    client.restore()
    assert client.is_deleted is False
    assert client.deleted_at is None


def test_pagination_envelope():
    items = [{"id": 1, "name": "Item 1"}, {"id": 2, "name": "Item 2"}]
    res = build_paginated_response(items=items, total=50, page=1, page_size=2)

    assert isinstance(res, PaginatedResponse)
    assert res.success is True
    assert len(res.data) == 2
    assert res.meta.total == 50
    assert res.meta.page == 1
    assert res.meta.page_size == 2
    assert res.meta.total_pages == 25
    assert res.meta.has_next is True
    assert res.meta.has_previous is False


def test_gstin_and_pan_validation():
    # Valid GSTIN and PAN
    valid_client = ClientCreate(
        name="Acme Corp",
        email="info@acme.com",
        gst_number="27AAPFU0939F1ZV",
        pan_number="ABCDE1234F",
    )
    assert valid_client.gst_number == "27AAPFU0939F1ZV"

    # Invalid GSTIN format
    with pytest.raises(ValidationError) as exc_info:
        ClientCreate(
            name="Acme Corp",
            email="info@acme.com",
            gst_number="INVALID_GSTIN_FORMAT",
        )
    assert "Invalid GSTIN format" in str(exc_info.value)

    # Invalid PAN format
    with pytest.raises(ValidationError) as exc_info:
        ClientCreate(
            name="Acme Corp",
            email="info@acme.com",
            pan_number="INVALID_PAN",
        )
    assert "Invalid PAN format" in str(exc_info.value)


def test_secure_storage_urls():
    url = generate_secure_signed_url("crm-documents/test_doc.pdf", storage_type="supabase")
    assert isinstance(url, str)
    assert len(url) > 0

    local_url = generate_secure_signed_url("uploads/documents/local_doc.pdf", storage_type="local")
    assert "/api/v1/documents/stream-file" in local_url
