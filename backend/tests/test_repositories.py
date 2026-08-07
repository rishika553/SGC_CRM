import uuid
import pytest
from app.repositories import (
    client_repository,
    agreement_repository,
    project_repository,
    task_repository,
    invoice_repository,
    document_repository,
    chat_repository,
    audit_repository,
)


def test_repository_instances():
    assert client_repository.model.__name__ == "Client"
    assert agreement_repository.model.__name__ == "Agreement"
    assert project_repository.model.__name__ == "Project"
    assert task_repository.model.__name__ == "Task"
    assert invoice_repository.model.__name__ == "Invoice"
    assert document_repository.model.__name__ == "Document"
    assert chat_repository.model.__name__ == "ChatMessage"
    assert audit_repository.model.__name__ == "AuditLog"


def test_repository_eager_options():
    assert len(client_repository.get_eager_options()) > 0
    assert len(agreement_repository.get_eager_options()) > 0
    assert len(project_repository.get_eager_options()) > 0
    assert len(task_repository.get_eager_options()) > 0
    assert len(invoice_repository.get_eager_options()) > 0
    assert len(document_repository.get_eager_options()) > 0
    assert len(audit_repository.get_eager_options()) > 0
