"""
TIP generation API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from database import get_db
from models.draft import Draft, DraftStatus
from models.document import Document
from models.template_file import TemplateFile
from schemas.draft import DraftCreate, DraftResponse, GenerateTIPRequest, GenerateTIPResponse, DraftUpdate, RefineRequest, RefineResponse
from services.claude import ClaudeService
from celery_app import generate_tip_task

router = APIRouter(prefix="/api/generate", tags=["generate"])

# Temporary: hardcoded user_id until we implement auth
TEMP_USER_ID = 1

def get_claude_service():
    """Get Claude service instance"""
    return ClaudeService()

@router.post("/draft", response_model=DraftResponse)
async def create_draft(
    draft_data: DraftCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new TIP draft
    """
    # Validate documents exist if provided
    if draft_data.discovery_document_id:
        doc = db.query(Document).filter(
            Document.id == draft_data.discovery_document_id,
            Document.user_id == TEMP_USER_ID
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Discovery document not found")
    
    if draft_data.service_order_document_id:
        doc = db.query(Document).filter(
            Document.id == draft_data.service_order_document_id,
            Document.user_id == TEMP_USER_ID
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Service order document not found")
    
    # Create draft
    draft = Draft(
        user_id=TEMP_USER_ID,
        title=draft_data.title,
        description=draft_data.description,
        discovery_document_id=draft_data.discovery_document_id,
        service_order_document_id=draft_data.service_order_document_id,
        template_id=draft_data.template_id,
        status=DraftStatus.DRAFT
    )
    
    db.add(draft)
    db.commit()
    db.refresh(draft)
    
    return draft

@router.post("/tip", response_model=GenerateTIPResponse)
async def generate_tip(
    request: GenerateTIPRequest,
    db: Session = Depends(get_db)
):
    """
    Enqueue TIP generation as a Celery task and return immediately.
    Poll GET /drafts/{id} to check status (generating → completed/failed).
    """
    draft = db.query(Draft).filter(
        Draft.id == request.draft_id,
        Draft.user_id == TEMP_USER_ID
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    active_template = db.query(TemplateFile).filter(TemplateFile.is_active == True).first()
    template_file_id = active_template.id if active_template else None

    draft.status = DraftStatus.GENERATING
    db.commit()

    generate_tip_task.delay(draft.id, template_file_id)

    return GenerateTIPResponse(
        message="TIP generation started",
        draft_id=draft.id,
        status=DraftStatus.GENERATING,
        content=None
    )

@router.get("/drafts", response_model=List[DraftResponse])
async def list_drafts(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    List all drafts for the current user
    """
    drafts = db.query(Draft)\
        .filter(Draft.user_id == TEMP_USER_ID)\
        .order_by(Draft.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return drafts

@router.patch("/drafts/{draft_id}", response_model=DraftResponse)
async def update_draft(
    draft_id: int,
    update: DraftUpdate,
    db: Session = Depends(get_db)
):
    draft = db.query(Draft).filter(Draft.id == draft_id, Draft.user_id == TEMP_USER_ID).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft.content = update.content
    if update.title:
        draft.title = update.title
    db.commit()
    db.refresh(draft)
    return draft

@router.post("/drafts/{draft_id}/refine", response_model=RefineResponse)
async def refine_draft(
    draft_id: int,
    request: RefineRequest,
    db: Session = Depends(get_db)
):
    draft = db.query(Draft).filter(Draft.id == draft_id, Draft.user_id == TEMP_USER_ID).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    try:
        claude_service = get_claude_service()
        content = request.current_content or draft.content or ""
        suggestion = await claude_service.refine_tip(
            instruction=request.instruction,
            current_content=content
        )
        return RefineResponse(suggestion=suggestion)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refinement failed: {str(e)}")

@router.get("/drafts/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: int,
    db: Session = Depends(get_db)
):
    """
    Get details of a specific draft
    """
    draft = db.query(Draft)\
        .filter(Draft.id == draft_id, Draft.user_id == TEMP_USER_ID)\
        .first()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    return draft

@router.delete("/drafts/{draft_id}")
async def delete_draft(draft_id: int, db: Session = Depends(get_db)):
    draft = db.query(Draft).filter(Draft.id == draft_id, Draft.user_id == TEMP_USER_ID).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    db.delete(draft)
    db.commit()
    return {"message": "Draft deleted", "id": draft_id}
