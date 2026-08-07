import enum
from sqlalchemy import String, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import BaseCRMModel


class UserRoleEnum(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    CLIENT = "client"
    CLIENT_VIEWER = "client_viewer"


class Role(BaseCRMModel):
    __tablename__ = "roles"

    name: Mapped[UserRoleEnum] = mapped_column(
        Enum(UserRoleEnum, native_enum=False, length=50),
        unique=True,
        nullable=False,
        index=True,
    )
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationships
    users = relationship("User", back_populates="role")
