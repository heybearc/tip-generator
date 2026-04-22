"""
Library document model — admin-managed reference TIPs, globally visible
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from database.config import Base


class LibraryStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LibraryDocument(Base):
    __tablename__ = "library_documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String, nullable=True)
    status = Column(Enum(LibraryStatus), default=LibraryStatus.PENDING, nullable=False, index=True)
    extracted_text = Column(Text, nullable=True)
    embedding = Column(Text, nullable=True)  # Reserved for future pgvector (D-LOCAL-014)

    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    uploader = relationship("User", foreign_keys=[uploaded_by], backref="library_uploads")
    approver = relationship("User", foreign_keys=[approved_by])

    def __repr__(self):
        return f"<LibraryDocument(id={self.id}, title={self.title}, category={self.category}, status={self.status})>"
