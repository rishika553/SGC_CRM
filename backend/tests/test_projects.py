import uuid
from datetime import datetime, timezone, timedelta
import pytest
from pydantic import ValidationError
from app.models.projects import ProjectStatusEnum, ProjectPriorityEnum
from app.schemas.projects import (
    ProjectCreate,
    ProjectUpdate,
    ProjectProgressUpdatePayload,
    ProjectRead,
)


def test_project_enums():
    assert ProjectStatusEnum.NOT_STARTED.value == "not_started"
    assert ProjectStatusEnum.IN_PROGRESS.value == "in_progress"
    assert ProjectStatusEnum.COMPLETED.value == "completed"
    assert ProjectPriorityEnum.HIGH.value == "high"
    assert ProjectPriorityEnum.CRITICAL.value == "critical"


def test_project_progress_validation():
    client_id = uuid.uuid4()
    # Valid progress 0-100
    p1 = ProjectCreate(name="ERP Integration", client_id=client_id, progress=50)
    assert p1.progress == 50

    # Progress > 100 invalid
    with pytest.raises(ValidationError) as exc_info:
        ProjectCreate(name="ERP Integration", client_id=client_id, progress=150)
    assert "Progress must be between 0 and 100" in str(exc_info.value)

    # Progress < 0 invalid
    with pytest.raises(ValidationError):
        ProjectCreate(name="ERP Integration", client_id=client_id, progress=-10)


def test_project_timeline_validation():
    client_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    start = now
    end = now + timedelta(days=30)
    invalid_end = now - timedelta(days=5)

    # Valid timeline
    p_valid = ProjectCreate(
        name="Cloud Migration",
        client_id=client_id,
        start_date=start,
        end_date=end,
    )
    assert p_valid.start_date == start

    # Invalid timeline (start_date > end_date)
    with pytest.raises(ValidationError) as exc_info:
        ProjectCreate(
            name="Cloud Migration",
            client_id=client_id,
            start_date=start,
            end_date=invalid_end,
        )
    assert "Start date cannot be after end date" in str(exc_info.value)


def test_project_computed_overdue():
    now = datetime.now(timezone.utc)
    past_deadline = now - timedelta(days=10)
    future_deadline = now + timedelta(days=10)

    # Overdue project
    overdue_proj = ProjectRead(
        id=uuid.uuid4(),
        name="Legacy System Audit",
        project_code="PRJ-1001",
        status=ProjectStatusEnum.IN_PROGRESS,
        priority=ProjectPriorityEnum.HIGH,
        progress=20,
        deadline=past_deadline,
        client_id=uuid.uuid4(),
        created_at=now,
        updated_at=now,
    )
    assert overdue_proj.is_overdue is True
    assert overdue_proj.days_remaining == 0

    # On-track project
    on_track_proj = ProjectRead(
        id=uuid.uuid4(),
        name="New Feature Deployment",
        project_code="PRJ-1002",
        status=ProjectStatusEnum.IN_PROGRESS,
        priority=ProjectPriorityEnum.MEDIUM,
        progress=60,
        deadline=future_deadline,
        client_id=uuid.uuid4(),
        created_at=now,
        updated_at=now,
    )
    assert on_track_proj.is_overdue is False
    assert on_track_proj.days_remaining > 0
