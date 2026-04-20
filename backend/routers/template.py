"""
Template file management API endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database.config import get_db
from models.template_file import TemplateFile
from schemas.template_file import TemplateFileResponse, TemplateFileUploadResponse
from services.template_parser import parse_template_file
from pathlib import Path
import os
import json
from services.upload import UploadService

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
        
        # Parse template structure
        try:
            parsed_structure = parse_template_file(str(file_path))
            structure_json = json.dumps(parsed_structure)
        except Exception as parse_error:
            print(f"Warning: Could not parse template structure: {parse_error}")
            structure_json = None
        
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
            notes=notes or f"Template version {next_version}",
            template_structure=structure_json
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

@router.get("/{template_id}/structure")
async def get_template_structure(
    template_id: int,
    db: Session = Depends(get_db)
):
    """
    Get the parsed structure of a template
    
    Returns:
    - sections: List of sections with headings and content
    - placeholders: List of all placeholders
    - instructions: List of Claude instructions
    - metadata: Document metadata
    """
    template = db.query(TemplateFile)\
        .filter(TemplateFile.id == template_id)\
        .first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if not template.template_structure:
        raise HTTPException(
            status_code=404, 
            detail="Template structure not available. Template may need to be re-uploaded."
        )
    
    try:
        structure = json.loads(template.template_structure)
        return structure
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Failed to parse template structure"
        )
