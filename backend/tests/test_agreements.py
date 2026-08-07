import uuid
import pytest
from pydantic import ValidationError
from app.models.agreements import AgreementTypeEnum, AgreementStatusEnum, ConsentStatusEnum
from app.schemas.agreements import (
    AgreementCreate,
    AgreementUpdate,
    AgreementSignPayload,
    AgreementConsentPayload,
    AgreementCreateVersionPayload,
)


def test_agreement_enums():
    assert AgreementTypeEnum.MSA.value == "msa"
    assert AgreementTypeEnum.NDA.value == "nda"
    assert AgreementStatusEnum.DRAFT.value == "draft"
    assert AgreementStatusEnum.SIGNED.value == "signed"
    assert ConsentStatusEnum.PENDING.value == "pending"
    assert ConsentStatusEnum.CONSENT_GIVEN.value == "consent_given"


def test_agreement_create_schema():
    client_id = uuid.uuid4()
    payload = AgreementCreate(
        title="Master Services Agreement 2026",
        type=AgreementTypeEnum.MSA,
        client_id=client_id,
        description="Comprehensive consulting SLA",
    )
    assert payload.title == "Master Services Agreement 2026"
    assert payload.type == AgreementTypeEnum.MSA
    assert payload.client_id == client_id


def test_agreement_signature_payload():
    payload = AgreementSignPayload(
        signed_by_name="Vikram Seth",
        signed_by_email="vikram@clientcorp.com",
    )
    assert payload.signed_by_name == "Vikram Seth"
    assert payload.signed_by_email == "vikram@clientcorp.com"

    with pytest.raises(ValidationError):
        AgreementSignPayload(
            signed_by_name="Vikram Seth",
            signed_by_email="invalid-email-string",
        )


def test_agreement_consent_payload():
    payload = AgreementConsentPayload(
        consent_status=ConsentStatusEnum.CONSENT_GIVEN,
        consent_notes="Client authorized electronic consent via email verification.",
    )
    assert payload.consent_status == ConsentStatusEnum.CONSENT_GIVEN
    assert "email verification" in payload.consent_notes


def test_agreement_version_payload():
    payload = AgreementCreateVersionPayload(
        title="Master Services Agreement 2026 (v2)",
        description="Updated payment terms in Section 4",
    )
    assert payload.title == "Master Services Agreement 2026 (v2)"
