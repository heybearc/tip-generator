"""
Document model for uploaded files
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from database.config import Base

class DocumentType(str, enum.Enum):
    DISCOVERY_EXCEL = "discovery_excel"
    SERVICE_ORDER_PDF = "service_order_pdf"
    OTHER = "other"

class DocumentStatus(str, enum.Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)  # Size in bytes
    mime_type = Column(String)
    document_type = Column(Enum(DocumentType), nullable=False)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.UPLOADING)
    extracted_text = Column(Text, nullable=True)  # Extracted content from document
    doc_metadata = Column(Text, nullable=True)  # JSON string for additional metadata
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", backref="documents")

    def __repr__(self):
        return f"<Document(id={self.id}, filename={self.filename}, type={self.document_type})>"
