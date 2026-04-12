"""SQLAlchemy model for taxonomy tags."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class TaxonomyTag(Base):
    __tablename__ = "taxonomy_tags"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    taxonomy_type = Column(String(50), nullable=False)
    taxonomy_value = Column(Text, nullable=False)
    tag = Column(Text, nullable=False)
    color = Column(String(20), default="#6366f1")
    match_type = Column(String(50))
    category = Column(String(200))
    concept = Column(String(200))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
