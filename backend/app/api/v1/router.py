from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    auth,
    users,
    roles,
    clients,
    contacts,
    communications,
    agreements,
    projects,
    tasks,
    invoices,
    documents,
    chat,
    settings,
    audit,
    whatsapp,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["System Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["User Management"])
api_router.include_router(roles.router, prefix="/roles", tags=["Role Management"])
api_router.include_router(clients.router, prefix="/clients", tags=["Client Account Management"])
api_router.include_router(contacts.router, prefix="/contacts", tags=["Contact Stakeholders"])
api_router.include_router(communications.router, prefix="/communications", tags=["Communication Logs"])
api_router.include_router(agreements.router, prefix="/agreements", tags=["Agreements Management"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects Management"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Task Management"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["Billing & Invoices Management"])
api_router.include_router(documents.router, prefix="/documents", tags=["Document Management"])
api_router.include_router(chat.router, prefix="/chat", tags=["Real-Time Chat"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings & Preferences"])
api_router.include_router(audit.router, prefix="/audit-logs", tags=["Audit Trails & Security Logs"])
api_router.include_router(whatsapp.router, prefix="/whatsapp", tags=["WhatsApp Web Management"])
