from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.models.meetings import MeetingStatusEnum, MeetingTypeEnum
from app.schemas.user import UserRead
from app.schemas.clients import ClientRead
from app.schemas.projects import ProjectRead
from app.schemas.assignments import AssignmentRead


class MeetingBase(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    meeting_type: MeetingTypeEnum = MeetingTypeEnum.IN_PERSON
    status: MeetingStatusEnum = MeetingStatusEnum.SCHEDULED
    start_time: datetime
    end_time: datetime
    timezone: str = "Asia/Kolkata"

    @model_validator(mode="after")
    def validate_times(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValueError("End time must be after start time")
        return self


class MeetingCreate(MeetingBase):
    client_id: UUID
    project_id: Optional[UUID] = None
    assignee_ids: Optional[List[UUID]] = None


class ClientMeetingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    meeting_type: MeetingTypeEnum = MeetingTypeEnum.IN_PERSON
    start_time: datetime
    end_time: datetime
    assignee_ids: Optional[List[UUID]] = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValueError("End time must be after start time")
        return self


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    meeting_type: Optional[MeetingTypeEnum] = None
    status: Optional[MeetingStatusEnum] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    timezone: Optional[str] = None
    client_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    assignee_ids: Optional[List[UUID]] = None

    @model_validator(mode="after")
    def validate_times(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValueError("End time must be after start time")
        return self


class MeetingRead(MeetingBase):
    id: UUID
    client_id: UUID
    project_id: Optional[UUID] = None
    created_by_id: Optional[UUID] = None

    client: Optional[ClientRead] = None
    project: Optional[ProjectRead] = None
    created_by: Optional[UserRead] = None
    assignees: List[AssignmentRead] = Field(default_factory=list, validation_alias="assignments")

    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
