"""SQLAlchemy model for standalone notes."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, DateTime, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class StandaloneNote(Base):
    __tablename__ = "standalone_notes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    title = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    note_type = Column(String(50), default="reflection")
    tags = Column(ARRAY(Text), default=[])
    linked_content_ids = Column(ARRAY(Text), default=[])
    linked_note_ids = Column(ARRAY(Text), default=[])
    source_content_id = Column(UUID(as_uuid=True))
    linked_project_id = Column(UUID(as_uuid=True))
    linked_model_id = Column(UUID(as_uuid=True))
    area_id = Column(UUID(as_uuid=True))
    is_pinned = Column(Boolean, default=False)
    is_completed = Column(Boolean, default=False)
    priority = Column(String(20))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
