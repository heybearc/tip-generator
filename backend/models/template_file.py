"""
Template file model for uploaded Word document templates
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from database.config import Base

class TemplateFile(Base):
    """Uploaded Word document templates (.docx)"""
    __tablename__ = "template_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)  # Original filename
    file_path = Column(String, nullable=False)  # Path on NFS storage
    file_size = Column(Integer)  # Size in bytes
    version = Column(Integer, nullable=False)  # Auto-increment version number
    is_active = Column(Boolean, default=False)  # Only one can be active
    
    # Metadata
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)  # What changed in this version
    template_structure = Column(Text, nullable=True)  # JSON: parsed template structure (sections, placeholders, instructions)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<TemplateFile(id={self.id}, filename={self.filename}, version={self.version}, active={self.is_active})>"
