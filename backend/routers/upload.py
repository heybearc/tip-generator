"""
File upload API endpoints
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form, Request
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.document import DocumentType, DocumentStatus
from models.user import User as UserModel
from schemas.document import DocumentUploadResponse, DocumentResponse
from services.upload import UploadService
from routers.auth import get_current_user
import os

router = APIRouter(prefix="/api", tags=["upload"])
upload_service = UploadService()

@router.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Generic document upload endpoint - auto-detects document type
    """
    # Auto-detect document type based on file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext in ['.xlsx', '.xls']:
        document_type = DocumentType.DISCOVERY_EXCEL
    elif file_ext == '.pdf':
        document_type = DocumentType.SERVICE_ORDER_PDF
    else:
        document_type = DocumentType.OTHER
    
    # Validate file size (10MB max)
    max_size = 10 * 1024 * 1024
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning
    
    if file_size > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")
    
    try:
        document = await upload_service.save_upload(
            file=file,
            document_type=document_type,
            user_id=current_user.id,
            db=db
        )
        
        return DocumentUploadResponse(
            message="File uploaded successfully",
            id=document.id,
            filename=document.original_filename,
            file_type=document.mime_type or file.content_type,
            file_size=document.file_size or 0,
            uploaded_at=document.created_at,
            status=document.status.value
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/discovery", response_model=DocumentUploadResponse)
async def upload_discovery_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
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
        user_id=current_user.id,
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
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
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
        user_id=current_user.id,
        db=db
    )
    
    return DocumentUploadResponse(
        message="Service order uploaded successfully",
        document_id=document.id,
        filename=document.original_filename,
        status=document.status
    )

@router.get("/documents/{document_id}/extracted-text")
async def get_extracted_text(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Preview the extracted text for a document — useful for verifying
    Excel parsing quality before generating a TIP.
    """
    from models.document import Document
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": document.id,
        "filename": document.original_filename,
        "document_type": document.document_type,
        "extracted_text": document.extracted_text,
        "char_count": len(document.extracted_text) if document.extracted_text else 0
    }

@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: UserModel = Depends(get_current_user),
):
    """
    List all uploaded documents for the current user
    """
    from models.document import Document
    
    from sqlalchemy import or_
    filters = [Document.user_id == current_user.id]
    if current_user.id != 1:
        filters.append(Document.user_id == 1)
    documents = db.query(Document)\
        .filter(or_(*filters))\
        .order_by(Document.user_id.asc(), Document.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return documents

@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Get details of a specific document
    """
    from models.document import Document
    
    from sqlalchemy import or_
    document = db.query(Document)\
        .filter(
            Document.id == document_id,
            or_(Document.user_id == current_user.id, Document.user_id == 1)
        )\
        .first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return document

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Delete a document and its file
    """
    from models.document import Document
    import os
    
    document = db.query(Document)\
        .filter(
            Document.id == document_id,
            Document.user_id == current_user.id
        )\
        .first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete the physical file
    if document.file_path and os.path.exists(document.file_path):
        try:
            os.remove(document.file_path)
        except Exception as e:
            # Log but don't fail if file deletion fails
            print(f"Warning: Could not delete file {document.file_path}: {e}")
    
    # Delete from database
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted successfully", "id": document_id}
