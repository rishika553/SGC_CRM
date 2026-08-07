import uuid
from datetime import datetime, timezone
import pytest
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogRead
from app.services.audit_service import log_audit_event


def test_audit_log_read_schema():
    user_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    log_data = AuditLogRead(
        id=uuid.uuid4(),
        action="AGREEMENT_SIGNED",
        entity_name="Agreement",
        entity_id="AGR-998877",
        changes={"status": {"old": "pending_signature", "new": "active"}},
        ip_address="192.168.1.100",
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        user_id=user_id,
        created_at=now,
    )

    assert log_data.action == "AGREEMENT_SIGNED"
    assert log_data.entity_name == "Agreement"
    assert log_data.ip_address == "192.168.1.100"
    assert log_data.changes["status"]["new"] == "active"
