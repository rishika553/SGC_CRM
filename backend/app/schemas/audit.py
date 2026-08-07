from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserRead


class AuditLogRead(BaseModel):
    id: UUID
    action: str
    entity_name: str
    entity_id: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    user_id: Optional[UUID] = None
    user: Optional[UserRead] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
