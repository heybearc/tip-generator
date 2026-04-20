"""
User schemas for API validation
"""
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    """Schema for creating a user"""
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    
class UserResponse(BaseModel):
    """Schema for user response"""
    id: int
    email: str
    username: str
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
