import uuid
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog


async def log_audit_event(
    db: AsyncSession,
    action: str,
    entity_name: str,
    entity_id: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
    user_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """
    Utility function to record an audit log entry.
    """
    audit_entry = AuditLog(
        action=action,
        entity_name=entity_name,
        entity_id=str(entity_id) if entity_id else None,
        changes=changes,
        user_id=user_id,
        created_by_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit_entry)
    # The session will be committed by caller or db middleware
    return audit_entry
