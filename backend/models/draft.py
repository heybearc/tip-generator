"""
Draft model for TIP work in progress
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from database.config import Base

class DraftStatus(str, enum.Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    ARCHIVED = "archived"

class Draft(Base):
    __tablename__ = "drafts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(DraftStatus), default=DraftStatus.DRAFT)
    
    # Source documents
    discovery_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    service_order_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    
    # Generated content
    content = Column(Text, nullable=True)  # Main TIP content
    sections = Column(JSON, nullable=True)  # Structured sections as JSON
    
    # Claude generation metadata
    claude_model = Column(String, nullable=True)
    generation_prompt = Column(Text, nullable=True)
    generation_tokens = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    generated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", backref="drafts")
    template = relationship("Template", backref="drafts")
    discovery_document = relationship("Document", foreign_keys=[discovery_document_id])
    service_order_document = relationship("Document", foreign_keys=[service_order_document_id])

    def __repr__(self):
        return f"<Draft(id={self.id}, title={self.title}, status={self.status})>"
