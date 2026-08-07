import uuid
from datetime import datetime, timezone, timedelta
import pytest
from pydantic import ValidationError
from app.models.tasks import TaskStatusEnum, TaskPriorityEnum
from app.schemas.tasks import (
    TaskCreate,
    TaskUpdate,
    TaskCommentCreate,
    TaskRead,
)


def test_task_enums():
    assert TaskStatusEnum.TODO.value == "todo"
    assert TaskStatusEnum.IN_PROGRESS.value == "in_progress"
    assert TaskStatusEnum.COMPLETED.value == "completed"
    assert TaskPriorityEnum.HIGH.value == "high"
    assert TaskPriorityEnum.URGENT.value == "urgent"


def test_task_create_validation():
    assigned_id = uuid.uuid4()
    # Valid Task
    t1 = TaskCreate(
        title="Prepare Q3 Audit Report",
        status=TaskStatusEnum.TODO,
        priority=TaskPriorityEnum.HIGH,
        assigned_to_id=assigned_id,
    )
    assert t1.title == "Prepare Q3 Audit Report"

    # Empty title invalid
    with pytest.raises(ValidationError) as exc_info:
        TaskCreate(title="   ")
    assert "Task title cannot be empty" in str(exc_info.value)


def test_task_comment_validation():
    c1 = TaskCommentCreate(content="Please double-check the figures on slide 4.")
    assert "slide 4" in c1.content

    with pytest.raises(ValidationError):
        TaskCommentCreate(content="")


def test_subtask_schema_relation():
    parent_id = uuid.uuid4()
    subtask = TaskCreate(
        title="Review Appendix A",
        parent_task_id=parent_id,
    )
    assert subtask.parent_task_id == parent_id


def test_task_overdue_calculation():
    now = datetime.now(timezone.utc)
    past_due = now - timedelta(days=2)
    future_due = now + timedelta(days=5)

    overdue_task = TaskRead(
        id=uuid.uuid4(),
        title="Tax Filing Submission",
        task_code="TSK-1001",
        status=TaskStatusEnum.IN_PROGRESS,
        priority=TaskPriorityEnum.URGENT,
        due_date=past_due,
        created_at=now,
        updated_at=now,
    )
    assert overdue_task.is_overdue is True

    completed_task = TaskRead(
        id=uuid.uuid4(),
        title="Tax Filing Submission",
        task_code="TSK-1002",
        status=TaskStatusEnum.COMPLETED,
        priority=TaskPriorityEnum.URGENT,
        due_date=past_due,
        created_at=now,
        updated_at=now,
    )
    assert completed_task.is_overdue is False
