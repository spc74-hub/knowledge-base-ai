"""SQLAlchemy model for user experts."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class UserExpert(Base):
    __tablename__ = "user_experts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    person_name = Column(Text, nullable=False)
    expert_categories = Column(ARRAY(Text), default=[])
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
