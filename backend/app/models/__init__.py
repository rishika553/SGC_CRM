from app.db.base import Base, BaseCRMModel
from app.models.role import Role, UserRoleEnum
from app.models.organization import Organization
from app.models.user import User
from app.models.audit import AuditLog
from app.models.clients import (
    Client,
    Contact,
    CommunicationLog,
    ClientTierEnum,
    ClientStatusEnum,
    CommunicationTypeEnum,
)
from app.models.agreements import (
    Agreement,
    AgreementTypeEnum,
    AgreementStatusEnum,
    ConsentStatusEnum,
)
from app.models.projects import (
    Project,
    ProjectStatusEnum,
    ProjectPriorityEnum,
)
from app.models.tasks import (
    Task,
    TaskComment,
    TaskStatusEnum,
    TaskPriorityEnum,
)
from app.models.invoices import (
    Invoice,
    InvoicePayment,
    InvoiceStatusEnum,
)
from app.models.documents import (
    Document,
    DocumentCategoryEnum,
)
from app.models.chat import (
    Conversation,
    ChatMessage,
    MessageTypeEnum,
)
from app.models.settings import (
    UserSettings,
)
from app.models.consents import (
    Consent,
    ConsentRequestStatusEnum,
)
from app.models.push_subscription import PushSubscription
from app.models.meetings import Meeting, MeetingStatusEnum, MeetingTypeEnum
from app.models.notes import Note
from app.models.assignments import (
    TaskAssignment,
    ProjectAssignment,
    ConsentAssignment,
    MeetingAssignment,
    ClientRM,
)

__all__ = [
    "Base",
    "BaseCRMModel",
    "Role",
    "UserRoleEnum",
    "Organization",
    "User",
    "AuditLog",
    "Client",
    "Contact",
    "CommunicationLog",
    "ClientTierEnum",
    "ClientStatusEnum",
    "CommunicationTypeEnum",
    "Agreement",
    "AgreementTypeEnum",
    "AgreementStatusEnum",
    "ConsentStatusEnum",
    "Project",
    "ProjectStatusEnum",
    "ProjectPriorityEnum",
    "Task",
    "TaskComment",
    "TaskStatusEnum",
    "TaskPriorityEnum",
    "Invoice",
    "InvoicePayment",
    "InvoiceStatusEnum",
    "Document",
    "DocumentCategoryEnum",
    "Conversation",
    "ChatMessage",
    "MessageTypeEnum",
    "UserSettings",
    "Consent",
    "ConsentRequestStatusEnum",
    "PushSubscription",
    "Meeting",
    "MeetingStatusEnum",
    "MeetingTypeEnum",
    "Note",
    "TaskAssignment",
    "ProjectAssignment",
    "ConsentAssignment",
    "MeetingAssignment",
    "ClientRM",
]
