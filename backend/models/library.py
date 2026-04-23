"""
Library document model — admin-managed reference TIPs, globally visible
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, Boolean, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from database.config import Base
from pgvector.sqlalchemy import Vector


class LibraryStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LibraryDocument(Base):
    __tablename__ = "library_documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False, default="", index=True)
    category_suggested = Column(Boolean, nullable=False, default=False)
    description = Column(Text, nullable=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    status = Column(Enum(LibraryStatus), default=LibraryStatus.PENDING, nullable=False, index=True)
    extracted_text = Column(Text, nullable=True)
    embedding = Column(Text, nullable=True)  # Legacy text field — kept for compat
    embedding_vec = Column(Vector(1536), nullable=True)  # pgvector whole-doc embedding

    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    uploader = relationship("User", foreign_keys=[uploaded_by], backref="library_uploads")
    approver = relationship("User", foreign_keys=[approved_by])
    chunks = relationship("LibraryChunk", back_populates="library_doc", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<LibraryDocument(id={self.id}, title={self.title}, category={self.category}, status={self.status})>"


class LibraryChunk(Base):
    __tablename__ = "library_chunks"

    id = Column(Integer, primary_key=True, index=True)
    library_doc_id = Column(Integer, ForeignKey("library_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    section_title = Column(Text, nullable=False)
    section_level = Column(Integer, nullable=False, default=1)
    content = Column(Text, nullable=False)
    embedding_vec = Column(Vector(1536), nullable=True)
    tech_tags = Column(ARRAY(String), nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    library_doc = relationship("LibraryDocument", back_populates="chunks")

    def __repr__(self):
        return f"<LibraryChunk(id={self.id}, doc_id={self.library_doc_id}, section='{self.section_title}')>"
