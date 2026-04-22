"""
Template file management API endpoints
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database.config import get_db
from models.template_file import TemplateFile
from models.user import User as UserModel
from schemas.template_file import TemplateFileResponse, TemplateFileUploadResponse
from services.template_parser import parse_template_file
from routers.auth import get_current_user
from pathlib import Path
import os
import json
from services.upload import UploadService

router = APIRouter(prefix="/api/templates", tags=["templates"])
upload_service = UploadService()

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
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
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
            uploaded_by=current_user.id,
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

@router.get("/active/instructions")
async def get_active_instructions(db: Session = Depends(get_db)):
    """
    Return the per-section instruction map for the active template.
    Shape: { "section_key": "instruction text", ... }
    """
    template = db.query(TemplateFile).filter(TemplateFile.is_active == True).first()
    if not template:
        raise HTTPException(status_code=404, detail="No active template found")
    if not template.template_structure:
        return {"instructions": {}}
    try:
        structure = json.loads(template.template_structure)
        raw = structure.get("instructions", [])
        # template_structure stores instructions as a list of {section, text, type}
        # Flatten into {section: text} map for easy lookup
        instr_map: dict = {}
        if isinstance(raw, list):
            for item in raw:
                sec = (item.get("section") or "").strip()
                txt = (item.get("text") or "").strip()
                if sec and txt:
                    instr_map[sec] = txt
        elif isinstance(raw, dict):
            instr_map = raw
        # Also include any manually-edited override map stored at structure["instruction_overrides"]
        overrides = structure.get("instruction_overrides", {})
        instr_map.update(overrides)
        return {"template_id": template.id, "version": template.version, "instructions": instr_map}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse instructions: {str(e)}")


@router.patch("/{template_id}/instructions")
async def update_instructions(
    template_id: int,
    body: dict,
    db: Session = Depends(get_db)
):
    """
    Update per-section instruction overrides for a template.
    Body: { "instructions": { "section_key": "new instruction text", ... } }
    Stored in template_structure["instruction_overrides"] so the original
    parsed instructions are preserved and overrides layer on top.
    """
    template = db.query(TemplateFile).filter(TemplateFile.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    updates: dict = body.get("instructions", {})
    if not isinstance(updates, dict):
        raise HTTPException(status_code=422, detail="instructions must be an object")

    try:
        structure = json.loads(template.template_structure) if template.template_structure else {}
        overrides = structure.get("instruction_overrides", {})
        overrides.update(updates)
        structure["instruction_overrides"] = overrides
        template.template_structure = json.dumps(structure)
        db.commit()
        return {"message": f"Updated {len(updates)} instruction(s)", "instruction_overrides": overrides}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")


@router.post("/{template_id}/reparse")
async def reparse_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Re-run the template parser against the stored file and update template_structure in the DB.
    Use this after updating the parser logic without re-uploading the file.
    """
    template = db.query(TemplateFile).filter(TemplateFile.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if not os.path.exists(template.file_path):
        raise HTTPException(status_code=404, detail="Template file not found on disk")

    try:
        parsed_structure = parse_template_file(template.file_path)
        # Preserve any existing instruction_overrides
        existing_overrides = {}
        if template.template_structure:
            try:
                existing = json.loads(template.template_structure)
                existing_overrides = existing.get("instruction_overrides", {})
            except Exception:
                pass
        if existing_overrides:
            parsed_structure["instruction_overrides"] = existing_overrides
        template.template_structure = json.dumps(parsed_structure)
        db.commit()
        structure = parsed_structure
        instruction_count = len(structure.get("instructions", []))
        section_count = len(structure.get("sections", []))
        return {
            "message": f"Template {template_id} reparsed successfully",
            "sections": section_count,
            "instructions": instruction_count,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Reparse failed: {str(e)}")


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
