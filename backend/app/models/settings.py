import uuid
from typing import Optional
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class UserSettings(BaseCRMModel):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Localizations
    timezone: Mapped[str] = mapped_column(String(100), default="Asia/Kolkata", nullable=False)
    language: Mapped[str] = mapped_column(String(20), default="en", nullable=False)

    # Email Preferences
    email_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_digest_frequency: Mapped[str] = mapped_column(String(50), default="daily", nullable=False)
    invoice_email_alerts: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    task_email_alerts: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    chat_email_alerts: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # In-App & Desktop Notification Preferences
    in_app_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    desktop_notifications: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    task_assigned_alert: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    agreement_signed_alert: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    invoice_paid_alert: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    chat_mention_alert: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
