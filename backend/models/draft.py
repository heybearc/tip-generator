"""
Draft model for TIP work in progress
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, JSON, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from database.config import Base


class DraftDocument(Base):
    __tablename__ = "draft_documents"
    __table_args__ = (UniqueConstraint("draft_id", "document_id", name="uq_draft_document"),)

    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, ForeignKey("drafts.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), nullable=False, default="supplemental")  # discovery | service_order | supplemental
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document")


class DraftCollaborator(Base):
    __tablename__ = "draft_collaborators"
    __table_args__ = (UniqueConstraint("draft_id", "user_id", name="uq_draft_collaborator"),)

    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, ForeignKey("drafts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    inviter = relationship("User", foreign_keys=[invited_by])

class DraftStatus(str, enum.Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"

class Draft(Base):
    __tablename__ = "drafts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    template_file_id = Column(Integer, ForeignKey("template_files.id"), nullable=True)  # Links to actual .docx template used
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
    celery_task_id = Column(String, nullable=True)
    library_examples_used = Column(JSON, nullable=True)  # [{title, category}] injected at generation time
    scrub_pii = Column(Boolean, nullable=False, default=True)
    additional_instructions = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    generated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", backref="drafts")
    template = relationship("Template", backref="drafts")
    discovery_document = relationship("Document", foreign_keys=[discovery_document_id])
    service_order_document = relationship("Document", foreign_keys=[service_order_document_id])
    collaborators = relationship("DraftCollaborator", backref="draft", cascade="all, delete-orphan", foreign_keys="DraftCollaborator.draft_id")
    draft_documents = relationship("DraftDocument", cascade="all, delete-orphan", foreign_keys="DraftDocument.draft_id")

    def __repr__(self):
        return f"<Draft(id={self.id}, title={self.title}, status={self.status})>"


class DraftPIIMap(Base):
    __tablename__ = "draft_pii_maps"

    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, ForeignKey("drafts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    pii_map = Column(JSONB, nullable=False, default=dict)  # {"{{TOKEN}}": "original_value"}
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<DraftPIIMap(draft_id={self.draft_id}, tokens={len(self.pii_map)})>"
