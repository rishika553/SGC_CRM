import uuid
import pytest
from pydantic import ValidationError
from app.models.documents import DocumentCategoryEnum
from app.schemas.documents import (
    DocumentCreate,
    DocumentUpdate,
    DocumentRead,
)


def test_document_category_enums():
    assert DocumentCategoryEnum.CONTRACT.value == "contract"
    assert DocumentCategoryEnum.INVOICE_BILL.value == "invoice_bill"
    assert DocumentCategoryEnum.PROPOSAL.value == "proposal"
    assert DocumentCategoryEnum.REPORT.value == "report"
    assert DocumentCategoryEnum.TAX_DOC.value == "tax_doc"


def test_document_create_schema():
    doc = DocumentCreate(
        title="Q3 Financial Audit Report",
        category=DocumentCategoryEnum.REPORT,
        description="Audited statement for Q3 2026",
    )
    assert doc.title == "Q3 Financial Audit Report"
    assert doc.category == DocumentCategoryEnum.REPORT

    with pytest.raises(ValidationError) as exc_info:
        DocumentCreate(title="   ")
    assert "Document title cannot be empty" in str(exc_info.value)


def test_document_versioning_schema():
    parent_id = uuid.uuid4()
    doc_v2 = DocumentCreate(
        title="Q3 Financial Audit Report (v2)",
        category=DocumentCategoryEnum.REPORT,
        parent_document_id=parent_id,
    )
    assert doc_v2.parent_document_id == parent_id
