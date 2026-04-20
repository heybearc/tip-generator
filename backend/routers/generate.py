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
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    draft = db.query(Draft).filter(Draft.id == draft_id, Draft.user_id == TEMP_USER_ID).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if not draft.content and not request.current_content:
        raise HTTPException(status_code=400, detail="Draft has no content to refine")
    try:
        claude_service = get_claude_service()
        content = request.current_content or draft.content or ""
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as pool:
            suggestion = await loop.run_in_executor(
                pool,
                lambda: claude_service.refine_tip(
                    instruction=request.instruction,
                    current_content=content
                )
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


@router.get("/template-instructions")
async def get_template_instructions():
    """Return the parsed instruction map from the Thrive TIP template."""
    import os, json as _json
    path = os.path.join(os.path.dirname(__file__), '..', 'static', 'template_instructions.json')
    path = os.path.normpath(path)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Template instructions not yet extracted")
    with open(path) as f:
        return _json.load(f)


@router.post("/drafts/{draft_id}/refine-guided")
async def refine_section_guided(
    draft_id: int,
    body: dict,
    db: Session = Depends(get_db),
    claude_service: ClaudeService = Depends(get_claude_service)
):
    """Refine a single section using the template instruction for that section type."""
    import os, json as _json

    draft = db.query(Draft).filter(Draft.id == draft_id, Draft.user_id == TEMP_USER_ID).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    import datetime as _dt
    from models.user import User as UserModel

    section_key = body.get("section_key", "")
    current_content = body.get("current_content", "")
    mode = body.get("mode", "tighten")  # tighten | comply | risks | both

    # Resolve author name from current user
    current_user = db.query(UserModel).filter(UserModel.id == TEMP_USER_ID).first()
    author_name = (current_user.full_name or current_user.username) if current_user else "Thrive"
    today = _dt.date.today().strftime("%B %d, %Y")

    # Load instruction map
    instr_path = os.path.join(os.path.dirname(__file__), '..', 'static', 'template_instructions.json')
    instr_path = os.path.normpath(instr_path)
    template_instructions = {}
    if os.path.exists(instr_path):
        with open(instr_path) as f:
            data = _json.load(f)
            template_instructions = data.get("instructions", {})

    # Hard-coded rules for sections the template doesn't have an explicit instruction block for
    HARD_RULES = {
        "revision history": (
            f"The Revision History table must use version number 1.0 for the initial release (never 0.1 or 0.9). "
            f"Format as a markdown table with columns: Rev #, Author(s), Change, Date. "
            f"The first and only row should be: | 1.0 | {author_name} | Initial Release | {today} |. "
            f"Today's date is {today}. The author is {author_name}. Do not use any other date or version number."
        ),
    }

    # Find the best matching instruction key — check hard rules first
    instruction_text = None
    for rule_key, rule_text in HARD_RULES.items():
        if rule_key in section_key.lower():
            instruction_text = rule_text
            break

    if not instruction_text:
        for key in template_instructions:
            if key and (key.lower() in section_key.lower() or section_key.lower() in key.lower()):
                instruction_text = template_instructions[key]
                break
    # Fallback: try substring match on H2-level keys
    if not instruction_text:
        h2_keys = ["Executive Summary", "Implementation Summary", "Requirements/Prerequisites",
                   "Approximate Timing", "Implementation Details", "Risks and Contingencies",
                   "Testing and Verification", "Day-1 Support", "Acceptance Criteria",
                   "Deliverables", "Timeline of Phases"]
        for key in h2_keys:
            if key.lower() in section_key.lower():
                instruction_text = template_instructions.get(key)
                break

    # Revision History: skip Claude entirely — stamp deterministically
    if "revision history" in section_key.lower():
        canonical = (
            "| Rev # | Author(s) | Change | Date |\n"
            "|-------|-----------|--------|------|\n"
            f"| 1.0 | {author_name} | Initial Release | {today} |"
        )
        return {
            "suggestion": canonical,
            "section_key": section_key,
            "instruction_used": f"Version 1.0, author = {author_name}, date = {today}",
            "mode": "direct"
        }

    mode_prompts = {
        "tighten": (
            "Your job is to tighten and condense this section. Remove redundancy, "
            "wordiness, and over-explanation. Preserve all factual detail. "
            "Aim to reduce length by 30-50% without losing substance."
        ),
        "comply": (
            "Your job is to rewrite this section so it precisely follows the template instruction below. "
            "Remove content that doesn't belong in this section type. Add structure the instruction requires. "
            "Keep all factual specifics from the original."
        ),
        "risks": (
            "Your job is to reformat the risks in this section to follow the 4-field structure: "
            "(1) Risk description, (2) Likelihood/Impact, (3) Mitigation strategy, (4) Rollback plan. "
            "Each risk should be a concise bullet block, not flowing prose."
        ),
        "both": (
            "Your job is to tighten AND rewrite this section to precisely follow the template instruction. "
            "Remove redundancy. Apply required structure. Preserve all factual detail from the original."
        ),
    }

    mode_instruction = mode_prompts.get(mode, mode_prompts["tighten"])

    instruction_block = f"\nTEMPLATE INSTRUCTION FOR THIS SECTION TYPE:\n{instruction_text}\n" if instruction_text else ""

    system_prompt = f"""You are a senior technical writer at Thrive Networks editing a Technical Implementation Plan (TIP).

{mode_instruction}
{instruction_block}
Rules:
- Return ONLY the revised section content, no preamble or explanation
- You MUST follow the template instruction above precisely — it is authoritative
- Preserve all customer-specific details, IP addresses, server names, dates
- Use markdown formatting (## headings, bullets, **bold** for key terms)
- Do not invent facts or add content not grounded in the original
- For Risks sections: use bullet blocks with the 4-field structure per risk: Risk | Likelihood/Impact | Mitigation | Rollback
- For Implementation Details: use numbered steps or clear sub-sections
- For Revision History: version 1.0 = initial release (never 0.1)"""

    prompt = f"""Section: {section_key}

Current content:
{current_content}

Rewrite this section following the rules above."""

    try:
        import anthropic
        import asyncio
        from concurrent.futures import ThreadPoolExecutor

        def _call_claude():
            client = anthropic.Anthropic()
            message = client.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}]
            )
            return message.content[0].text

        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as pool:
            suggestion = await loop.run_in_executor(pool, _call_claude)

        return {
            "suggestion": suggestion,
            "section_key": section_key,
            "instruction_used": instruction_text or "general tighten",
            "mode": mode
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refinement failed: {str(e)}")


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

    import os

    doc = DocxDocument()

    # Page margins
    for sec in doc.sections:
        sec.top_margin = Inches(1)
        sec.bottom_margin = Inches(1)
        sec.left_margin = Inches(1.25)
        sec.right_margin = Inches(1.25)

    # --- Header: Thrive logo left, doc title right ---
    logo_path = os.path.join(os.path.dirname(__file__), '..', 'static', 'thrive_logo.jpg')
    logo_path = os.path.normpath(logo_path)
    for sec in doc.sections:
        hdr = sec.header
        hdr.is_linked_to_previous = False
        hdr_para = hdr.paragraphs[0] if hdr.paragraphs else hdr.add_paragraph()
        hdr_para.clear()
        from docx.oxml import OxmlElement as OE
        from docx.oxml.ns import qn as QN
        # Tab stop for right-aligned title
        pPr = hdr_para._p.get_or_add_pPr()
        tabs = OE('w:tabs')
        tab = OE('w:tab')
        tab.set(QN('w:val'), 'right')
        tab.set(QN('w:pos'), '9360')  # 6.5 inches in twips
        tabs.append(tab)
        pPr.append(tabs)
        # Logo run
        if os.path.exists(logo_path):
            logo_run = hdr_para.add_run()
            logo_run.add_picture(logo_path, height=Inches(0.35))
        # Tab + title
        title_run = hdr_para.add_run(f'\t{draft.title}')
        title_run.font.size = Pt(9)
        title_run.font.color.rgb = RGBColor(0x14, 0x3F, 0x6A)
        # Bottom border on header
        pBdr = OE('w:pBdr')
        btm = OE('w:bottom')
        btm.set(QN('w:val'), 'single')
        btm.set(QN('w:sz'), '4')
        btm.set(QN('w:color'), '143F6A')
        pBdr.append(btm)
        pPr.append(pBdr)

    # --- Footer: left text + right page number ---
    for sec in doc.sections:
        ftr = sec.footer
        ftr.is_linked_to_previous = False
        ftr_para = ftr.paragraphs[0] if ftr.paragraphs else ftr.add_paragraph()
        ftr_para.clear()
        pPr2 = ftr_para._p.get_or_add_pPr()
        tabs2 = OE('w:tabs')
        tab2 = OE('w:tab')
        tab2.set(QN('w:val'), 'right')
        tab2.set(QN('w:pos'), '9360')
        tabs2.append(tab2)
        pPr2.append(tabs2)
        left_run = ftr_para.add_run('Thrive Networks — Confidential')
        left_run.font.size = Pt(8)
        left_run.font.color.rgb = RGBColor(0x8C, 0x9A, 0x9E)
        # Tab then page field
        tab_run = ftr_para.add_run('\tPage ')
        tab_run.font.size = Pt(8)
        tab_run.font.color.rgb = RGBColor(0x8C, 0x9A, 0x9E)
        # PAGE field
        fld_begin = OE('w:fldChar')
        fld_begin.set(QN('w:fldCharType'), 'begin')
        r_pg = OE('w:r')
        r_pg.append(fld_begin)
        ftr_para._p.append(r_pg)
        instr = OE('w:r')
        instr_txt = OE('w:instrText')
        instr_txt.text = ' PAGE \\* MERGEFORMAT '
        instr.append(instr_txt)
        ftr_para._p.append(instr)
        fld_end = OE('w:fldChar')
        fld_end.set(QN('w:fldCharType'), 'end')
        r_end = OE('w:r')
        r_end.append(fld_end)
        ftr_para._p.append(r_end)

    def add_inline_runs(para, text: str, base_size=None):
        """Parse inline **bold**, *italic*, `code` and add runs to para."""
        parts = re.split(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)', text)
        for part in parts:
            if part.startswith('**') and part.endswith('**') and len(part) > 4:
                r = para.add_run(part[2:-2])
                r.font.bold = True
                if base_size: r.font.size = base_size
            elif part.startswith('*') and part.endswith('*') and len(part) > 2:
                r = para.add_run(part[1:-1])
                r.font.italic = True
                if base_size: r.font.size = base_size
            elif part.startswith('`') and part.endswith('`') and len(part) > 2:
                r = para.add_run(part[1:-1])
                r.font.name = 'Courier New'
                r.font.size = Pt(9)
            else:
                r = para.add_run(part)
                if base_size: r.font.size = base_size

    def shade_cell(cell, hex_color: str):
        """Apply background fill to a single table cell."""
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), hex_color)
        tcPr.append(shd)

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

    # Cover / title block
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title_para.add_run(draft.title)
    run.font.size = Pt(22)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x14, 0x3F, 0x6A)
    sub_para = doc.add_paragraph()
    sub_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub_para.add_run('Technical Implementation Plan')
    sub_run.font.size = Pt(12)
    sub_run.font.color.rgb = RGBColor(0x8C, 0x9A, 0x9E)
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
            rows = [l for l in table_lines if not re.match(r'^\ *\|[-| :]+\|\s*$', l)]
            if rows:
                cols = len(rows[0].split('|')) - 2
                t = doc.add_table(rows=0, cols=max(cols, 1))
                t.style = 'Table Grid'
                for ri, row_line in enumerate(rows):
                    cells = [c.strip() for c in row_line.strip('|').split('|')]
                    tr = t.add_row()
                    for ci, cell_text in enumerate(cells[:max(cols, 1)]):
                        cell_obj = tr.cells[ci]
                        cell_obj.text = ''
                        cell_para = cell_obj.paragraphs[0]
                        add_inline_runs(cell_para, cell_text)
                        if ri == 0:
                            shade_cell(cell_obj, '143F6A')
                            for r in cell_para.runs:
                                r.font.bold = True
                                r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            table_lines = []
            # Don't skip current line

        # Blockquote / callout
        if line.startswith('> '):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.4)
            pPr = p._p.get_or_add_pPr()
            pBdr = OxmlElement('w:pBdr')
            left = OxmlElement('w:left')
            left.set(qn('w:val'), 'single')
            left.set(qn('w:sz'), '12')
            left.set(qn('w:color'), '143F6A')
            pBdr.append(left)
            pPr.append(pBdr)
            add_inline_runs(p, line[2:].strip())
            for r in p.runs:
                r.font.color.rgb = RGBColor(0x14, 0x3F, 0x6A)
                r.font.italic = True
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
            add_inline_runs(p, line[2:])
            i += 1
            continue

        # Blank line
        if line.strip() == '':
            i += 1
            continue

        # Normal paragraph
        p = doc.add_paragraph()
        add_inline_runs(p, line)
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
                    cell_obj = tr.cells[ci]
                    cell_obj.text = ''
                    cell_para = cell_obj.paragraphs[0]
                    add_inline_runs(cell_para, cell_text)
                    if ri == 0:
                        shade_cell(cell_obj, '143F6A')
                        for r in cell_para.runs:
                            r.font.bold = True
                            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

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
