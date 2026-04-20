"""
Draft schemas for API validation
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any
from models.draft import DraftStatus

class DraftCreate(BaseModel):
    """Schema for creating a draft"""
    title: str
    description: Optional[str] = None
    discovery_document_id: Optional[int] = None
    service_order_document_id: Optional[int] = None
    template_id: Optional[int] = None

class DraftResponse(BaseModel):
    """Schema for draft response"""
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    status: DraftStatus
    content: Optional[str] = None
    sections: Optional[Dict[str, Any]] = None
    claude_model: Optional[str] = None
    generation_tokens: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    generated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class DraftUpdate(BaseModel):
    """Schema for updating a draft's content"""
    content: str
    title: Optional[str] = None

class GenerateTIPRequest(BaseModel):
    """Request to generate a TIP"""
    draft_id: int

class GenerateTIPResponse(BaseModel):
    """Response after TIP generation"""
    message: str
    draft_id: int
    status: DraftStatus
    content: Optional[str] = None

class RefineRequest(BaseModel):
    """Request to refine a draft with Claude"""
    instruction: str
    current_content: Optional[str] = None

class RefineResponse(BaseModel):
    """Response from Claude refinement"""
    suggestion: str
