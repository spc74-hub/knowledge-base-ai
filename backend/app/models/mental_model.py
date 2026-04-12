"""SQLAlchemy models for mental models."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class MentalModel(Base):
    __tablename__ = "mental_models"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    slug = Column(String(100), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    notes = Column(Text, default="")
    is_active = Column(Boolean, default=True)
    is_favorite = Column(Boolean, default=False)
    color = Column(String(20), default="#8b5cf6")
    icon = Column(String(10), default="🧠")
    content_count = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("user_id", "slug"),)


class ContentMentalModel(Base):
    __tablename__ = "content_mental_models"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    mental_model_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    application_notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("content_id", "mental_model_id"),)


class MentalModelAction(Base):
    __tablename__ = "mental_model_actions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mental_model_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    title = Column(Text, nullable=False)
    is_completed = Column(Boolean, default=False)
    position = Column(Integer, default=0)
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MentalModelNote(Base):
    __tablename__ = "mental_model_notes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mental_model_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    note_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("mental_model_id", "note_id"),)
