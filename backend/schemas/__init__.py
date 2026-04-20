"""
Pydantic schemas for request/response validation
"""
from .document import DocumentCreate, DocumentResponse, DocumentStatus, DocumentType
from .user import UserCreate, UserResponse
from .draft import DraftCreate, DraftResponse, GenerateTIPRequest, GenerateTIPResponse

__all__ = [
    "DocumentCreate",
    "DocumentResponse", 
    "DocumentStatus",
    "DocumentType",
    "UserCreate",
    "UserResponse",
    "DraftCreate",
    "DraftResponse",
    "GenerateTIPRequest",
    "GenerateTIPResponse"
]
