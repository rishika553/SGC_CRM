import pytest
from pydantic import ValidationError
from app.models.clients import ClientTierEnum, ClientStatusEnum, Client
from app.schemas.clients import ClientCreate, ClientUpdate


def test_client_enums():
    assert ClientTierEnum.ENTERPRISE.value == "enterprise"
    assert ClientTierEnum.MID_MARKET.value == "mid_market"
    assert ClientStatusEnum.ACTIVE.value == "active"
    assert ClientStatusEnum.PROSPECT.value == "prospect"
    assert ClientStatusEnum.ONBOARDING.value == "onboarding"
    assert ClientStatusEnum.INACTIVE.value == "inactive"
    assert ClientStatusEnum.SUSPENDED.value == "suspended"


def test_gst_validation():
    # Valid GSTIN
    valid_payload = ClientCreate(
        name="Acme Corp",
        gst_number="27AAPFU0939F1ZV",
    )
    assert valid_payload.gst_number == "27AAPFU0939F1ZV"

    # Lowercase should automatically convert to uppercase
    lowercase_payload = ClientCreate(
        name="Acme Corp",
        gst_number="27aapfu0939f1zv",
    )
    assert lowercase_payload.gst_number == "27AAPFU0939F1ZV"

    # Invalid GSTIN format (wrong character count / structure)
    with pytest.raises(ValidationError) as exc_info:
        ClientCreate(
            name="Acme Corp",
            gst_number="INVALID_GST_123",
        )
    assert "Invalid GSTIN format" in str(exc_info.value)


def test_pan_validation():
    # Valid PAN
    valid_payload = ClientCreate(
        name="Acme Corp",
        pan_number="ABCDE1234F",
    )
    assert valid_payload.pan_number == "ABCDE1234F"

    # Lowercase should automatically convert to uppercase
    lowercase_payload = ClientCreate(
        name="Acme Corp",
        pan_number="abcde1234f",
    )
    assert lowercase_payload.pan_number == "ABCDE1234F"

    # Invalid PAN format
    with pytest.raises(ValidationError) as exc_info:
        ClientCreate(
            name="Acme Corp",
            pan_number="12345ABCDE",
        )
    assert "Invalid PAN format" in str(exc_info.value)


def test_phone_and_postal_validation():
    # Valid phone & postal code
    valid = ClientCreate(
        name="Acme Corp",
        phone="+91 9876543210",
        postal_code="400001"
    )
    assert valid.phone == "+91 9876543210"
    assert valid.postal_code == "400001"

    # Invalid phone
    with pytest.raises(ValidationError):
        ClientCreate(
            name="Acme Corp",
            phone="abc-invalid-phone"
        )


def test_client_profile_schema_fields():
    payload = ClientCreate(
        name="Nexus Technologies",
        legal_name="Nexus Technologies India Pvt Ltd",
        company_type="Private Limited",
        industry="Information Technology",
        company_size="100-500",
        website="https://nexus.example.com",
        annual_revenue=5000000.0,
        currency="INR",
        gst_number="07AABCN1234D1Z2",
        pan_number="AABCN1234D",
        primary_contact_name="Rajan Sharma",
        email="contact@nexus.example.com",
        phone="+91 9988776655",
        address_line1="Suite 401, Tech Park",
        address_line2="Outer Ring Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560103",
        country="India",
        status=ClientStatusEnum.ACTIVE,
        tier=ClientTierEnum.ENTERPRISE
    )

    assert payload.name == "Nexus Technologies"
    assert payload.legal_name == "Nexus Technologies India Pvt Ltd"
    assert payload.gst_number == "07AABCN1234D1Z2"
    assert payload.pan_number == "AABCN1234D"
    assert payload.city == "Bengaluru"
    assert payload.status == ClientStatusEnum.ACTIVE
