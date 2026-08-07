import pytest
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_token,
)


def test_password_hashing():
    raw_password = "SuperSecretPassword123!"
    hashed = get_password_hash(raw_password)

    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_lifecycle():
    user_id = "f8ea6680-363b-41ec-a565-1425bbc7bc09"
    token = create_access_token(subject=user_id, additional_claims={"role": "super_admin"})

    payload = decode_token(token)
    assert payload["sub"] == user_id
    assert payload["type"] == "access"
    assert payload["role"] == "super_admin"


def test_invalid_jwt_token():
    with pytest.raises(ValueError):
        decode_token("invalid.jwt.token.value")
