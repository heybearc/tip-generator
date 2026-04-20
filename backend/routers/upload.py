"""
File upload API endpoints
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.document import DocumentType, DocumentStatus
from schemas.document import DocumentUploadResponse, DocumentResponse
from services.upload import UploadService
import os

router = APIRouter(prefix="/api/upload", tags=["upload"])
upload_service = UploadService()

# Temporary: hardcoded user_id until we implement auth
TEMP_USER_ID = 1

@router.post("/discovery", response_model=DocumentUploadResponse)
async def upload_discovery_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload Excel discovery worksheet
    """
    # Validate file extension
    allowed_extensions = ['.xlsx', '.xls']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Check file size (50MB limit)
    max_size = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50")) * 1024 * 1024
    content = await file.read()
    await file.seek(0)  # Reset file pointer
    
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {max_size / 1024 / 1024}MB"
        )
    
    # Save and process file
    document = await upload_service.save_upload(
        file=file,
        document_type=DocumentType.DISCOVERY_EXCEL,
        user_id=TEMP_USER_ID,
        db=db
    )
    
    return DocumentUploadResponse(
        message="Discovery document uploaded successfully",
        document_id=document.id,
        filename=document.original_filename,
        status=document.status
    )

@router.post("/service-order", response_model=DocumentUploadResponse)
async def upload_service_order(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload PDF service order
    """
    # Validate file extension
    allowed_extensions = ['.pdf']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Check file size
    max_size = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50")) * 1024 * 1024
    content = await file.read()
    await file.seek(0)
    
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {max_size / 1024 / 1024}MB"
        )
    
    # Save and process file
    document = await upload_service.save_upload(
        file=file,
        document_type=DocumentType.SERVICE_ORDER_PDF,
        user_id=TEMP_USER_ID,
        db=db
    )
    
    return DocumentUploadResponse(
        message="Service order uploaded successfully",
        document_id=document.id,
        filename=document.original_filename,
        status=document.status
    )

@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    List all uploaded documents for the current user
    """
    from models.document import Document
    
    documents = db.query(Document)\
        .filter(Document.user_id == TEMP_USER_ID)\
        .order_by(Document.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return documents

@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: Session = Depends(get_db)
):
    """
    Get details of a specific document
    """
    from models.document import Document
    
    document = db.query(Document)\
        .filter(Document.id == document_id, Document.user_id == TEMP_USER_ID)\
        .first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return document
