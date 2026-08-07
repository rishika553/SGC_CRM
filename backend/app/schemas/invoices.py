from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from app.models.invoices import InvoiceStatusEnum
from app.schemas.user import UserRead
from app.schemas.clients import ClientRead
from app.schemas.projects import ProjectRead


class InvoicePaymentCreate(BaseModel):
    payment_amount: float
    payment_date: Optional[datetime] = None
    payment_method: str = "Bank Transfer / NEFT"
    reference_number: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("payment_amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Payment amount must be greater than 0")
        return v


class InvoicePaymentRead(BaseModel):
    id: UUID
    invoice_id: UUID
    payment_amount: float
    payment_date: datetime
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    recorded_by_id: UUID
    recorded_by: Optional[UserRead] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvoiceBase(BaseModel):
    subtotal: float
    tax_rate: float = 18.0
    due_date: datetime
    currency: str = "INR"
    status: InvoiceStatusEnum = InvoiceStatusEnum.UNPAID
    notes: Optional[str] = None

    @field_validator("subtotal")
    @classmethod
    def validate_subtotal(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Subtotal cannot be negative")
        return v

    @field_validator("tax_rate")
    @classmethod
    def validate_tax_rate(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Tax rate cannot be negative")
        return v


class InvoiceCreate(InvoiceBase):
    client_id: UUID
    project_id: Optional[UUID] = None
    assigned_admin_id: Optional[UUID] = None
    invoice_number: Optional[str] = None
    issue_date: Optional[datetime] = None


class InvoiceUpdate(BaseModel):
    subtotal: Optional[float] = None
    tax_rate: Optional[float] = None
    due_date: Optional[datetime] = None
    currency: Optional[str] = None
    status: Optional[InvoiceStatusEnum] = None
    notes: Optional[str] = None
    assigned_admin_id: Optional[UUID] = None
    project_id: Optional[UUID] = None

    @field_validator("subtotal")
    @classmethod
    def validate_subtotal(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Subtotal cannot be negative")
        return v

    @field_validator("tax_rate")
    @classmethod
    def validate_tax_rate(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Tax rate cannot be negative")
        return v


class InvoiceRead(InvoiceBase):
    id: UUID
    invoice_number: str
    issue_date: datetime
    tax_amount: float
    total_amount: float
    paid_amount: float
    outstanding_amount: float
    paid_at: Optional[datetime] = None
    pdf_file_path: Optional[str] = None

    client_id: UUID
    project_id: Optional[UUID] = None
    assigned_admin_id: Optional[UUID] = None

    client: Optional[ClientRead] = None
    project: Optional[ProjectRead] = None
    assigned_admin: Optional[UserRead] = None

    is_overdue: bool = False
    days_overdue: int = 0

    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def calculate_computed_fields(self):
        now = datetime.now(timezone.utc)
        if self.due_date and self.status not in (InvoiceStatusEnum.PAID, InvoiceStatusEnum.CANCELLED):
            if self.due_date < now:
                self.is_overdue = True
                delta = now - self.due_date
                self.days_overdue = max(0, delta.days)
            else:
                self.is_overdue = False
                self.days_overdue = 0
        else:
            self.is_overdue = False
            self.days_overdue = 0
        return self


class InvoiceDetailRead(InvoiceRead):
    payments: List[InvoicePaymentRead] = []

    model_config = ConfigDict(from_attributes=True)
