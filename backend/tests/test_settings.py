import pytest
from pydantic import ValidationError
from app.schemas.settings import (
    PasswordChangePayload,
    UserProfileUpdate,
    UserSettingsUpdate,
    CompanyProfileUpdate,
)


def test_password_change_validation():
    # Valid password payload
    valid = PasswordChangePayload(
        current_password="old_secure_pass123",
        new_password="new_secure_pass456",
        confirm_password="new_secure_pass456",
    )
    assert valid.new_password == "new_secure_pass456"

    # Password mismatch
    with pytest.raises(ValidationError) as exc_info:
        PasswordChangePayload(
            current_password="old_secure_pass123",
            new_password="new_secure_pass456",
            confirm_password="different_password",
        )
    assert "do not match" in str(exc_info.value)

    # Password too short (< 8 chars)
    with pytest.raises(ValidationError) as exc_info:
        PasswordChangePayload(
            current_password="old",
            new_password="short",
            confirm_password="short",
        )
    assert "at least 8 characters" in str(exc_info.value)


def test_user_profile_update_schema():
    up = UserProfileUpdate(
        first_name="Rishika",
        last_name="Sharma",
        phone_number="+91 9876543210",
        job_title="Managing Director",
    )
    assert up.first_name == "Rishika"
    assert up.job_title == "Managing Director"

    with pytest.raises(ValidationError):
        UserProfileUpdate(first_name="   ")


def test_user_settings_preferences_schema():
    pref = UserSettingsUpdate(
        timezone="Asia/Kolkata",
        language="en",
        email_digest_frequency="weekly",
        desktop_notifications=True,
    )
    assert pref.timezone == "Asia/Kolkata"
    assert pref.desktop_notifications is True


def test_company_profile_update_schema():
    comp = CompanyProfileUpdate(
        name="SGC Global Consulting Pvt Ltd",
        legal_name="SGC Global Consulting Private Limited",
        tax_id="27AAPFU0939F1ZV",
        country="India",
    )
    assert comp.name == "SGC Global Consulting Pvt Ltd"
    assert comp.tax_id == "27AAPFU0939F1ZV"
