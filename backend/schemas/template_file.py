"""
Template file schemas for API validation
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TemplateFileResponse(BaseModel):
    """Schema for template file response"""
    id: int
    filename: str
    file_size: int
    version: int
    is_active: bool
    uploaded_by: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class TemplateFileUploadResponse(BaseModel):
    """Response after successful template upload"""
    message: str
    id: int
    filename: str
    version: int
    is_active: bool
    created_at: datetime
