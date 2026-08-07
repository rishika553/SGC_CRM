from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator
from app.models.documents import DocumentCategoryEnum
from app.schemas.user import UserRead
from app.schemas.clients import ClientRead
from app.schemas.projects import ProjectRead


class DocumentBase(BaseModel):
    title: str
    category: DocumentCategoryEnum = DocumentCategoryEnum.OTHER
    description: Optional[str] = None
    is_secured: bool = True

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Document title cannot be empty")
        return v.strip()


class DocumentCreate(DocumentBase):
    client_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    parent_document_id: Optional[UUID] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[DocumentCategoryEnum] = None
    description: Optional[str] = None
    is_secured: Optional[bool] = None
    client_id: Optional[UUID] = None
    project_id: Optional[UUID] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not str(v).strip():
            raise ValueError("Document title cannot be empty")
        return str(v).strip() if v is not None else None


class SecureUrlRead(BaseModel):
    document_id: UUID
    title: str
    secure_url: str
    preview_url: str
    download_url: str
    expires_in_seconds: int = 3600


class DocumentRead(DocumentBase):
    id: UUID
    file_name: str
    storage_path: str
    storage_type: str
    public_url: Optional[str] = None
    file_size: int
    mime_type: str
    file_extension: Optional[str] = None
    file_checksum: Optional[str] = None
    version: int

    client_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    uploaded_by_id: Optional[UUID] = None
    parent_document_id: Optional[UUID] = None

    client: Optional[ClientRead] = None
    project: Optional[ProjectRead] = None
    uploaded_by: Optional[UserRead] = None

    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentVersionRead(BaseModel):
    id: UUID
    title: str
    file_name: str
    version: int
    file_size: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentDetailRead(DocumentRead):
    versions: List[DocumentVersionRead] = []
    signed_preview_url: Optional[str] = None
    signed_download_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
