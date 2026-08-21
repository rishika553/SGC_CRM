from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserRead
from app.schemas.clients import ClientRead
from app.schemas.projects import ProjectRead


class NoteBase(BaseModel):
    title: str
    content: str


class NoteCreate(NoteBase):
    client_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    meeting_id: Optional[UUID] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    client_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    meeting_id: Optional[UUID] = None


class NoteMeetingSummary(BaseModel):
    id: UUID
    title: str
    start_time: datetime
    end_time: datetime
    status: str
    model_config = ConfigDict(from_attributes=True)


class NoteRead(NoteBase):
    id: UUID
    client_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    meeting_id: Optional[UUID] = None

    client: Optional[ClientRead] = None
    project: Optional[ProjectRead] = None
    meeting: Optional[NoteMeetingSummary] = None
    created_by: Optional[UserRead] = None

    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
