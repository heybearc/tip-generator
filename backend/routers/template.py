"""
Template file management API endpoints
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.template_file import TemplateFile
from schemas.template_file import TemplateFileResponse, TemplateFileUploadResponse
from services.upload import UploadService
import os
from pathlib import Path

router = APIRouter(prefix="/api/templates", tags=["templates"])
upload_service = UploadService()

# Temporary: hardcoded user_id until we implement auth
TEMP_USER_ID = 1

@router.get("/current", response_model=TemplateFileResponse)
async def get_current_template(db: Session = Depends(get_db)):
    """
    Get the currently active template
    """
    template = db.query(TemplateFile)\
        .filter(TemplateFile.is_active == True)\
        .first()
    
    if not template:
        raise HTTPException(status_code=404, detail="No active template found")
    
    return template

@router.get("/history", response_model=List[TemplateFileResponse])
async def get_template_history(
    db: Session = Depends(get_db),
    limit: int = 10
):
    """
    Get template version history
    """
    templates = db.query(TemplateFile)\
        .order_by(TemplateFile.version.desc())\
        .limit(limit)\
        .all()
    
    return templates

@router.post("/upload", response_model=TemplateFileUploadResponse)
async def upload_template(
    file: UploadFile = File(...),
    notes: str = "",
    db: Session = Depends(get_db)
):
    """
    Upload a new TIP template (Word document)
    """
    # Validate file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ['.docx']:
        raise HTTPException(
            status_code=400, 
            detail="Only .docx files are allowed for templates"
        )
    
    # Validate file size (10MB max)
    max_size = 10 * 1024 * 1024
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")
    
    try:
        # Get next version number
        latest = db.query(TemplateFile)\
            .order_by(TemplateFile.version.desc())\
            .first()
        next_version = (latest.version + 1) if latest else 1
        
        # Save file to NFS storage
        upload_dir = Path("/mnt/tip-uploads/templates")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename with version
        safe_filename = f"tip_template_v{next_version}{file_ext}"
        file_path = upload_dir / safe_filename
        
        # Write file
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Deactivate all previous templates
        db.query(TemplateFile)\
            .update({"is_active": False})
        
        # Create new template record
        template = TemplateFile(
            filename=file.filename,
            file_path=str(file_path),
            file_size=file_size,
            version=next_version,
            is_active=True,
            uploaded_by=TEMP_USER_ID,
            notes=notes or f"Template version {next_version}"
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        return TemplateFileUploadResponse(
            message=f"Template uploaded successfully as version {next_version}",
            id=template.id,
            filename=template.filename,
            version=template.version,
            is_active=template.is_active,
            created_at=template.created_at
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/{template_id}/activate", response_model=TemplateFileResponse)
async def activate_template(
    template_id: int,
    db: Session = Depends(get_db)
):
    """
    Activate a specific template version (revert to previous)
    """
    template = db.query(TemplateFile)\
        .filter(TemplateFile.id == template_id)\
        .first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Deactivate all templates
    db.query(TemplateFile)\
        .update({"is_active": False})
    
    # Activate selected template
    template.is_active = True
    db.commit()
    db.refresh(template)
    
    return template

@router.get("/download/{template_id}")
async def download_template(
    template_id: int,
    db: Session = Depends(get_db)
):
    """
    Download a specific template version
    """
    from fastapi.responses import FileResponse
    
    template = db.query(TemplateFile)\
        .filter(TemplateFile.id == template_id)\
        .first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if not os.path.exists(template.file_path):
        raise HTTPException(status_code=404, detail="Template file not found on disk")
    
    return FileResponse(
        path=template.file_path,
        filename=template.filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
