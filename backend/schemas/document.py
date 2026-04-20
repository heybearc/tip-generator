"""
Document schemas for API validation
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from models.document import DocumentType, DocumentStatus

class DocumentCreate(BaseModel):
    """Schema for creating a document"""
    filename: str
    document_type: DocumentType
    
class DocumentResponse(BaseModel):
    """Schema for document response"""
    id: int
    user_id: int
    filename: str
    original_filename: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    document_type: DocumentType
    status: DocumentStatus
    created_at: datetime
    processed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    
    class Config:
        from_attributes = True

class DocumentUploadResponse(BaseModel):
    """Response after successful upload"""
    message: str
    document_id: int
    filename: str
    status: DocumentStatus
