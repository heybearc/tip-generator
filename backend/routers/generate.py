"""
TIP generation API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import io
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


@router.patch("/drafts/{draft_id}/sections/{section_key}")
async def update_draft_section(
    draft_id: int,
    section_key: str,
    body: dict,
    db: Session = Depends(get_db)
):
    """Update a single section of a draft by key."""
    draft = db.query(Draft).filter(Draft.id == draft_id, Draft.user_id == TEMP_USER_ID).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    sections = dict(draft.sections or {})
    sections[section_key] = body.get("content", "")
    draft.sections = sections
    draft.content = "\n\n".join(
        f"## {k}\n\n{v}" for k, v in sections.items() if v
    )
    db.commit()
    db.refresh(draft)
    return {"section": section_key, "saved": True}


@router.get("/drafts/{draft_id}/export")
async def export_draft_docx(draft_id: int, db: Session = Depends(get_db)):
    """Export a completed draft as a formatted Word (.docx) document."""
    from docx import Document as DocxDocument
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    import re

    draft = db.query(Draft).filter(Draft.id == draft_id, Draft.user_id == TEMP_USER_ID).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if not draft.content:
        raise HTTPException(status_code=400, detail="Draft has no content to export")

    doc = DocxDocument()

    # Page margins
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1.25)
        section.right_margin = Inches(1.25)

    def set_heading_style(para, level: int):
        """Apply Thrive brand heading colors."""
        run = para.runs[0] if para.runs else para.add_run()
        if level == 1:
            run.font.size = Pt(14)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0x14, 0x3F, 0x6A)
        elif level == 2:
            run.font.size = Pt(12)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0x14, 0x3F, 0x6A)
        elif level == 3:
            run.font.size = Pt(11)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0x14, 0x3E, 0x69)

    def add_horizontal_rule(doc):
        p = doc.add_paragraph()
        pPr = p._p.get_or_add_pPr()
        pBdr = OxmlElement('w:pBdr')
        bottom = OxmlElement('w:bottom')
        bottom.set(qn('w:val'), 'single')
        bottom.set(qn('w:sz'), '6')
        bottom.set(qn('w:space'), '1')
        bottom.set(qn('w:color'), '143F6A')
        pBdr.append(bottom)
        pPr.append(pBdr)
        return p

    # Title page
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title_para.add_run(draft.title)
    run.font.size = Pt(24)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x11, 0x17, 0x1B)
    doc.add_paragraph()

    # Parse and render content
    lines = draft.content.split('\n')
    i = 0
    table_lines = []
    in_table = False

    while i < len(lines):
        line = lines[i]

        # Table detection
        if line.strip().startswith('|'):
            table_lines.append(line)
            i += 1
            continue
        elif table_lines:
            # Flush table
            rows = [l for l in table_lines if not re.match(r'^\s*\|[-| :]+\|\s*$', l)]
            if rows:
                cols = len(rows[0].split('|')) - 2
                t = doc.add_table(rows=0, cols=max(cols, 1))
                t.style = 'Table Grid'
                for ri, row_line in enumerate(rows):
                    cells = [c.strip() for c in row_line.strip('|').split('|')]
                    tr = t.add_row()
                    for ci, cell_text in enumerate(cells[:max(cols, 1)]):
                        tr.cells[ci].text = cell_text
                        if ri == 0:
                            for run in tr.cells[ci].paragraphs[0].runs:
                                run.font.bold = True
                                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                        # Header row shading
                        tc = tr.cells[ci]._tc
                        tcPr = tc.get_or_add_tcPr()
                        shd = OxmlElement('w:shd')
                        shd.set(qn('w:val'), 'clear')
                        shd.set(qn('w:color'), 'auto')
                        shd.set(qn('w:fill'), '143F6A')
                        tcPr.append(shd)
            table_lines = []
            # Don't skip current line

        # Blockquote / callout
        if line.startswith('> '):
            p = doc.add_paragraph(line[2:].strip())
            p.paragraph_format.left_indent = Inches(0.4)
            pPr = p._p.get_or_add_pPr()
            pBdr = OxmlElement('w:pBdr')
            left = OxmlElement('w:left')
            left.set(qn('w:val'), 'single')
            left.set(qn('w:sz'), '12')
            left.set(qn('w:color'), '8C9A9E')
            pBdr.append(left)
            pPr.append(pBdr)
            for run in p.runs:
                run.font.color.rgb = RGBColor(0x14, 0x3F, 0x6A)
                run.font.italic = True
            i += 1
            continue

        # Headings
        if line.startswith('# '):
            p = doc.add_paragraph(line[2:])
            set_heading_style(p, 1)
            add_horizontal_rule(doc)
            i += 1
            continue
        if line.startswith('## '):
            p = doc.add_paragraph(line[3:])
            set_heading_style(p, 2)
            i += 1
            continue
        if line.startswith('### '):
            p = doc.add_paragraph(line[4:])
            set_heading_style(p, 3)
            i += 1
            continue

        # Horizontal rule
        if line.strip() in ('---', '***', '___'):
            add_horizontal_rule(doc)
            i += 1
            continue

        # Bullet / checklist
        if line.startswith('- [ ] ') or line.startswith('[ ] '):
            text = line.lstrip('- ').lstrip('[ ] ').strip()
            p = doc.add_paragraph(style='List Bullet')
            p.add_run(f'☐  {text}')
            i += 1
            continue
        if line.startswith('- [x] ') or line.startswith('[x] '):
            text = line.lstrip('- ').lstrip('[x] ').strip()
            p = doc.add_paragraph(style='List Bullet')
            p.add_run(f'☑  {text}')
            i += 1
            continue
        if line.startswith('- ') or line.startswith('* '):
            p = doc.add_paragraph(style='List Bullet')
            p.add_run(line[2:])
            i += 1
            continue

        # Blank line
        if line.strip() == '':
            i += 1
            continue

        # Normal paragraph — handle inline bold/italic
        p = doc.add_paragraph()
        parts = re.split(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)', line)
        for part in parts:
            if part.startswith('**') and part.endswith('**'):
                run = p.add_run(part[2:-2])
                run.font.bold = True
            elif part.startswith('*') and part.endswith('*'):
                run = p.add_run(part[1:-1])
                run.font.italic = True
            elif part.startswith('`') and part.endswith('`'):
                run = p.add_run(part[1:-1])
                run.font.name = 'Courier New'
                run.font.size = Pt(9)
            else:
                p.add_run(part)
        i += 1

    # Flush any trailing table
    if table_lines:
        rows = [l for l in table_lines if not re.match(r'^\s*\|[-| :]+\|\s*$', l)]
        if rows:
            cols = len(rows[0].split('|')) - 2
            t = doc.add_table(rows=0, cols=max(cols, 1))
            t.style = 'Table Grid'
            for ri, row_line in enumerate(rows):
                cells = [c.strip() for c in row_line.strip('|').split('|')]
                tr = t.add_row()
                for ci, cell_text in enumerate(cells[:max(cols, 1)]):
                    tr.cells[ci].text = cell_text
                    if ri == 0:
                        for run in tr.cells[ci].paragraphs[0].runs:
                            run.font.bold = True

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)

    safe_title = re.sub(r'[^\w\s-]', '', draft.title).strip().replace(' ', '_')
    filename = f"{safe_title}.docx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
