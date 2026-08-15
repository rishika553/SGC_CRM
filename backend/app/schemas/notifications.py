from typing import Optional
from pydantic import BaseModel, Field


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(..., min_length=1)
    auth: str = Field(..., min_length=1)


class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(..., min_length=1)
    keys: PushSubscriptionKeys
    user_agent: Optional[str] = None


class PushSubscriptionRemove(BaseModel):
    endpoint: str = Field(..., min_length=1)


class PushConfigRead(BaseModel):
    enabled: bool
    vapid_public_key: str
