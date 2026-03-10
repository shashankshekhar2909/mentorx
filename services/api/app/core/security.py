from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    expires_delta = timedelta(minutes=settings.access_token_exp_minutes)
    return _encode_token(subject, expires_delta, extra or {}, token_type="access")


def create_refresh_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    expires_delta = timedelta(days=settings.refresh_token_exp_days)
    return _encode_token(subject, expires_delta, extra or {}, token_type="refresh")


def _encode_token(subject: str, expires_delta: timedelta, extra: dict[str, Any], token_type: str) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "exp": expire, "type": token_type, **extra}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
