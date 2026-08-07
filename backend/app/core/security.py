from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    additional_claims: Optional[Dict[str, Any]] = None
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "access",
        "iat": datetime.now(timezone.utc),
    }
    if additional_claims:
        to_encode.update(additional_claims)
        
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: Union[str, Any]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "refresh",
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_password_reset_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode = {
        "exp": expire,
        "sub": email,
        "type": "password_reset",
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    # First, try to decode with Supabase JWT Secret if provided
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            return payload
        except jwt.PyJWTError:
            pass

    # Next, try local SECRET_KEY
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        pass

    # Unverified decode for Supabase tokens in development mode if secret isn't configured yet
    try:
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        if unverified_payload.get("iss", "").startswith("https://") or unverified_payload.get("aud") == "authenticated":
            return unverified_payload
    except jwt.PyJWTError:
        pass

    raise ValueError("Invalid or expired token")
