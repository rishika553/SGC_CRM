import uuid
import pytest
from pydantic import ValidationError
from app.models.consents import ConsentRequestStatusEnum
from app.schemas.consents import ConsentRead, ConsentUpdate, ConsentResponsePayload


def test_consent_request_status_enums():
    assert ConsentRequestStatusEnum.PENDING.value == "pending"
    assert ConsentRequestStatusEnum.ALLOWED.value == "allowed"
    assert ConsentRequestStatusEnum.DENIED.value == "denied"


def test_consent_response_payload_allowed():
    payload = ConsentResponsePayload(
        status=ConsentRequestStatusEnum.ALLOWED,
        response_notes="Client authorized via email verification.",
    )
    assert payload.status == ConsentRequestStatusEnum.ALLOWED
    assert payload.denial_reason is None
    assert "email verification" in payload.response_notes


def test_consent_response_payload_denied():
    payload = ConsentResponsePayload(
        status=ConsentRequestStatusEnum.DENIED,
        denial_reason="Marketing communications not authorized at this time.",
    )
    assert payload.status == ConsentRequestStatusEnum.DENIED
    assert payload.denial_reason


def test_consent_response_payload_rejects_pending():
    with pytest.raises(ValidationError):
        ConsentResponsePayload(status=ConsentRequestStatusEnum.PENDING)


def test_consent_update_schema():
    payload = ConsentUpdate(title="Updated Consent Title")
    assert payload.title == "Updated Consent Title"
    assert payload.description is None


def test_consent_read_schema_from_attributes():
    consent_id = uuid.uuid4()
    client_id = uuid.uuid4()
    consent = ConsentRead(
        id=consent_id,
        title="Data Sharing Consent",
        description="Permission to process contact data",
        status=ConsentRequestStatusEnum.PENDING,
        client_id=client_id,
        created_at="2026-08-09T10:00:00Z",
        updated_at="2026-08-09T10:00:00Z",
    )
    assert consent.status == ConsentRequestStatusEnum.PENDING
    assert consent.client_id == client_id
    assert consent.is_deleted is False
