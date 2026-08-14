from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.models.projects import ProjectStatusEnum, ProjectPriorityEnum
from app.models.tasks import TaskPriorityEnum, TaskStatusEnum
from app.schemas.user import UserRead
from app.schemas.clients import ClientRead


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    notes: Optional[str] = None
    status: ProjectStatusEnum = ProjectStatusEnum.NOT_STARTED
    priority: ProjectPriorityEnum = ProjectPriorityEnum.MEDIUM
    progress: int = 0
    budget: Optional[float] = None
    currency: Optional[str] = "INR"

    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    deadline: Optional[datetime] = None

    @field_validator("progress", mode="before")
    @classmethod
    def validate_progress(cls, v: int) -> int:
        if v is None:
            return 0
        v_int = int(v)
        if v_int < 0 or v_int > 100:
            raise ValueError("Progress must be between 0 and 100 percentage points")
        return v_int

    @model_validator(mode="after")
    def validate_timeline(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("Start date cannot be after end date")
        if self.start_date and self.deadline and self.start_date > self.deadline:
            raise ValueError("Start date cannot be after deadline")
        return self


class ProjectCreate(ProjectBase):
    client_id: Optional[UUID] = None
    assigned_admin_id: Optional[UUID] = None
    project_code: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[ProjectStatusEnum] = None
    priority: Optional[ProjectPriorityEnum] = None
    progress: Optional[int] = None
    budget: Optional[float] = None
    currency: Optional[str] = None

    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    deadline: Optional[datetime] = None

    assigned_admin_id: Optional[UUID] = None

    @field_validator("progress", mode="before")
    @classmethod
    def validate_progress(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        v_int = int(v)
        if v_int < 0 or v_int > 100:
            raise ValueError("Progress must be between 0 and 100 percentage points")
        return v_int

    @model_validator(mode="after")
    def validate_timeline(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("Start date cannot be after end date")
        if self.start_date and self.deadline and self.start_date > self.deadline:
            raise ValueError("Start date cannot be after deadline")
        return self


class ProjectProgressUpdatePayload(BaseModel):
    progress: int
    status: Optional[ProjectStatusEnum] = None
    notes: Optional[str] = None

    @field_validator("progress", mode="before")
    @classmethod
    def validate_progress(cls, v: int) -> int:
        if v is None:
            return 0
        v_int = int(v)
        if v_int < 0 or v_int > 100:
            raise ValueError("Progress must be between 0 and 100 percentage points")
        return v_int


class ProjectTaskRead(BaseModel):
    """Task fields required by the Projects & Tasks screen."""

    id: UUID
    title: str
    status: TaskStatusEnum
    priority: TaskPriorityEnum
    parent_task_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectRead(ProjectBase):
    id: UUID
    project_code: str
    actual_completion_date: Optional[datetime] = None

    client_id: UUID
    assigned_admin_id: Optional[UUID] = None

    client: Optional[ClientRead] = None
    assigned_admin: Optional[UserRead] = None
    tasks: List[ProjectTaskRead] = Field(default_factory=list)

    is_overdue: bool = False
    days_remaining: Optional[int] = None

    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def calculate_computed_fields(self):
        now = datetime.now(timezone.utc)
        target_date = self.deadline or self.end_date

        if target_date and self.status != ProjectStatusEnum.COMPLETED:
            if target_date < now:
                self.is_overdue = True
                self.days_remaining = 0
            else:
                self.is_overdue = False
                delta = target_date - now
                self.days_remaining = max(0, delta.days)
        else:
            self.is_overdue = False
            self.days_remaining = None

        return self


class ProjectDetailRead(ProjectRead):
    model_config = ConfigDict(from_attributes=True)
