"""
TIP generation API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.draft import Draft, DraftStatus
from models.document import Document
from schemas.draft import DraftCreate, DraftResponse, GenerateTIPRequest, GenerateTIPResponse
from services.claude import ClaudeService

router = APIRouter(prefix="/api/generate", tags=["generate"])
claude_service = ClaudeService()

# Temporary: hardcoded user_id until we implement auth
TEMP_USER_ID = 1

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
    Generate TIP using Claude API
    """
    # Get draft
    draft = db.query(Draft).filter(
        Draft.id == request.draft_id,
        Draft.user_id == TEMP_USER_ID
    ).first()
    
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Get associated documents
    discovery_doc = None
    service_order_doc = None
    
    if draft.discovery_document_id:
        discovery_doc = db.query(Document).filter(
            Document.id == draft.discovery_document_id
        ).first()
    
    if draft.service_order_document_id:
        service_order_doc = db.query(Document).filter(
            Document.id == draft.service_order_document_id
        ).first()
    
    # Generate TIP
    try:
        updated_draft = await claude_service.generate_tip(
            draft=draft,
            discovery_doc=discovery_doc,
            service_order_doc=service_order_doc,
            db=db
        )
        
        return GenerateTIPResponse(
            message="TIP generated successfully",
            draft_id=updated_draft.id,
            status=updated_draft.status,
            content=updated_draft.content
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate TIP: {str(e)}"
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
