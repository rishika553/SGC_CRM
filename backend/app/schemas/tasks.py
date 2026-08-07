from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from app.models.tasks import TaskStatusEnum, TaskPriorityEnum
from app.schemas.user import UserRead
from app.schemas.clients import ClientRead


class TaskCommentCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Comment content cannot be empty")
        return v.strip()


class TaskCommentRead(BaseModel):
    id: UUID
    task_id: UUID
    user_id: UUID
    content: str
    user: Optional[UserRead] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatusEnum = TaskStatusEnum.TODO
    priority: TaskPriorityEnum = TaskPriorityEnum.MEDIUM
    due_date: Optional[datetime] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Task title cannot be empty")
        return v.strip()


class TaskCreate(TaskBase):
    assigned_to_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    parent_task_id: Optional[UUID] = None
    task_code: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatusEnum] = None
    priority: Optional[TaskPriorityEnum] = None
    due_date: Optional[datetime] = None

    assigned_to_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    parent_task_id: Optional[UUID] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not str(v).strip():
            raise ValueError("Task title cannot be empty")
        return str(v).strip() if v is not None else None


class TaskStatusUpdatePayload(BaseModel):
    status: TaskStatusEnum
    comment: Optional[str] = None


class TaskRead(TaskBase):
    id: UUID
    task_code: str
    completed_at: Optional[datetime] = None

    assigned_to_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    client_id: Optional[UUID] = None
    parent_task_id: Optional[UUID] = None

    assigned_to: Optional[UserRead] = None
    client: Optional[ClientRead] = None

    is_overdue: bool = False
    days_remaining: Optional[int] = None
    subtasks_count: int = 0

    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def calculate_computed_fields(self):
        try:
            now = datetime.now(timezone.utc)
            if self.due_date and self.status not in (TaskStatusEnum.COMPLETED, TaskStatusEnum.CANCELLED):
                due = self.due_date
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                if due < now:
                    self.is_overdue = True
                    self.days_remaining = 0
                else:
                    self.is_overdue = False
                    delta = due - now
                    self.days_remaining = max(0, delta.days)
            else:
                self.is_overdue = False
                self.days_remaining = None
        except Exception:
            self.is_overdue = False
            self.days_remaining = None

        return self


class TaskDetailRead(TaskRead):
    subtasks: List[TaskRead] = []
    comments: List[TaskCommentRead] = []

    model_config = ConfigDict(from_attributes=True)
