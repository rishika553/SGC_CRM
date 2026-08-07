import uuid
from datetime import datetime, timezone, timedelta
import pytest
from pydantic import ValidationError
from app.models.invoices import InvoiceStatusEnum
from app.schemas.invoices import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoicePaymentCreate,
    InvoiceRead,
)


def test_invoice_enums():
    assert InvoiceStatusEnum.UNPAID.value == "unpaid"
    assert InvoiceStatusEnum.PARTIALLY_PAID.value == "partially_paid"
    assert InvoiceStatusEnum.PAID.value == "paid"
    assert InvoiceStatusEnum.OVERDUE.value == "overdue"


def test_invoice_financial_validation():
    client_id = uuid.uuid4()
    due_date = datetime.now(timezone.utc) + timedelta(days=30)

    # Valid Invoice
    inv = InvoiceCreate(
        client_id=client_id,
        subtotal=100000.0,
        tax_rate=18.0,
        due_date=due_date,
    )
    assert inv.subtotal == 100000.0
    assert inv.tax_rate == 18.0

    # Negative subtotal invalid
    with pytest.raises(ValidationError) as exc_info:
        InvoiceCreate(
            client_id=client_id,
            subtotal=-500.0,
            due_date=due_date,
        )
    assert "Subtotal cannot be negative" in str(exc_info.value)


def test_payment_amount_validation():
    # Valid payment
    p = InvoicePaymentCreate(
        payment_amount=25000.0,
        payment_method="NEFT Bank Transfer",
        reference_number="UTR123456789",
    )
    assert p.payment_amount == 25000.0

    # Zero or negative payment invalid
    with pytest.raises(ValidationError) as exc_info:
        InvoicePaymentCreate(payment_amount=0.0)
    assert "Payment amount must be greater than 0" in str(exc_info.value)


def test_invoice_overdue_computed():
    now = datetime.now(timezone.utc)
    past_due = now - timedelta(days=5)

    inv_read = InvoiceRead(
        id=uuid.uuid4(),
        invoice_number="INV-1001",
        issue_date=now - timedelta(days=35),
        due_date=past_due,
        subtotal=50000.0,
        tax_rate=18.0,
        tax_amount=9000.0,
        total_amount=59000.0,
        paid_amount=0.0,
        outstanding_amount=59000.0,
        status=InvoiceStatusEnum.UNPAID,
        client_id=uuid.uuid4(),
        created_at=now,
        updated_at=now,
    )
    assert inv_read.is_overdue is True
    assert inv_read.days_overdue >= 4
