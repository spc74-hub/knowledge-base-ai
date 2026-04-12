"""SQLAlchemy models for objectives."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class Objective(Base):
    __tablename__ = "objectives"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    horizon = Column(String(20), default="yearly")
    target_date = Column(Date)
    status = Column(String(20), default="pending")
    progress = Column(Integer, default=0)
    color = Column(String(20), default="#6366f1")
    icon = Column(String(10), default="🎯")
    parent_id = Column(UUID(as_uuid=True))
    area_id = Column(UUID(as_uuid=True))
    position = Column(Integer, default=0)
    is_favorite = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True))


class ObjectiveAction(Base):
    __tablename__ = "objective_actions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    objective_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    title = Column(Text, nullable=False)
    is_completed = Column(Boolean, default=False)
    position = Column(Integer, default=0)
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ObjectiveContent(Base):
    __tablename__ = "objective_contents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    objective_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    content_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("objective_id", "content_id"),)


class ObjectiveMentalModel(Base):
    __tablename__ = "objective_mental_models"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    objective_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    mental_model_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("objective_id", "mental_model_id"),)


class ObjectiveNote(Base):
    __tablename__ = "objective_notes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    objective_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    note_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("objective_id", "note_id"),)
