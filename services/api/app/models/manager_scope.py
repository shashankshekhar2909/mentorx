from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class ManagerScope(Base):
    __tablename__ = "manager_scopes"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    categories_csv: Mapped[str] = mapped_column(Text, default="")
