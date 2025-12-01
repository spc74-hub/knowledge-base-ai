"""
SQLAlchemy models for content.
"""
from sqlalchemy import Column, String, Text, TIMESTAMP, JSON, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
import uuid
from datetime import datetime

Base = declarative_base()

class Content(Base):
    __tablename__ = "contents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    url = Column(Text, nullable=False)
    type = Column(String(50))  # 'web', 'youtube', 'tiktok', 'twitter'
    
    # Schema.org classification
    schema_type = Column(String(100))
    schema_subtype = Column(String(100))
    
    # IAB Taxonomy
    iab_tier1 = Column(String(100))
    iab_tier2 = Column(String(100))
    iab_tier3 = Column(String(100))
    
    # Content
    title = Column(Text)
    summary = Column(Text)
    raw_content = Column(Text)
    
    # Concepts and entities
    concepts = Column(ARRAY(Text))
    entities = Column(JSONB)
    
    # Metadata
    language = Column(String(10))
    sentiment = Column(String(20))
    technical_level = Column(String(20))
    content_format = Column(String(50))
    user_tags = Column(ARRAY(Text))
    
    # Embedding (handled separately with pgvector)
    # embedding = Column(Vector(1536))
    
    # Additional metadata
    metadata = Column(JSONB)
    
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)
