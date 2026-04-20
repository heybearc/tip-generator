# TIP Generator Plan

**Last updated:** 2026-04-20  
**Current phase:** Active refinement — template-guided editing, export polish  
**Status:** Phases 1.1–1.6 complete; working on document quality and auth

---

**Development Discipline:**
- 🔵 **Blue-Green Development**: Work on ONE container at a time (CT190 blue = dev, CT191 green = stable)
- 🛡️ **Database Protection**: NEVER reset/erase DB, use backwards-compatible migrations only
- 🔄 **Deployment Flow**: Dev on blue → Test → Deploy to green → Switch traffic

---

## Current Phase: End-to-End Testing

### Active Work (IN PROGRESS)
**Phase 1 Testing** — First real end-to-end run with real documents
- ⏳ Upload Excel discovery workbook + PDF service order
- ⏳ Verify Excel extraction quality via `/api/documents/{id}/extracted-text`
- ⏳ Generate TIP — confirm single-pass vs chunked mode selected correctly
- ⏳ Review generated content in DraftViewPage
- ⏳ Test AI Assist panel (refine with Claude)
- ⏳ Test Edit + Save flow

---

## Completed Phases

**Phase 1.1: Infrastructure & Deployment** ✅
- ✅ Blue-green containers (CT190 @ 10.92.3.91, CT191 @ 10.92.3.92)
- ✅ HAProxy + NPM + SSL, shared PostgreSQL + NFS
- ✅ FastAPI backend + React/Vite frontend deployed

**Phase 1.2: Document & Template Management** ✅
- ✅ Document upload (Excel, PDF, Word), drag & drop UI
- ✅ Document management page with delete
- ✅ Template management (/admin/template), versioning, upload/download/activate

**Phase 1.3: Template Parsing** ✅
- ✅ TemplateParser service — extracts sections, placeholders, Claude instructions from .docx
- ✅ `template_structure` JSON field added to `template_files` table (backwards compatible)
- ✅ Parse on upload, store structure in DB
- ✅ GET /api/templates/{id}/structure endpoint

**Phase 1.4: Template Display** ✅
- ✅ Collapsible structure viewer on /admin/template page
- ✅ Shows section hierarchy, placeholder count, Claude instruction list
- ✅ Active template banner on Generate page

**Phase 1.5: TIP Generation Engine** ✅
- ✅ Template-aware Claude prompting — populates each section from source docs
- ✅ Auto-detects document size, switches to chunked generation (5 sections/call) when > 40k chars
- ✅ Smart Excel extractor — detects key-value blocks, tables, section headers across sheets
- ✅ `/api/documents/{id}/extracted-text` endpoint for extraction quality preview
- ✅ Draft PATCH endpoint (save edits)
- ✅ Draft /refine endpoint (AI-assisted editing via Claude)
- ✅ DraftViewPage — formatted viewer, edit mode, AI Assist chat panel
- ✅ DraftsPage — real list with status icons and click-through
- ✅ HomePage — live stats (doc count, draft count, active template)
- ✅ DB migration: `template_file_id` on drafts table

---

## Upcoming Phases

### Phase 1.6: TIP Export (NEXT)
**Objective:** Export generated TIP as Word document and PDF

**Tasks:**
- Word (.docx) export — populate original template file with generated content using python-docx
- PDF export — convert docx to PDF (via LibreOffice headless or WeasyPrint)
- Download endpoint: GET /api/drafts/{id}/export?format=docx|pdf
- Export button on DraftViewPage (currently wired but no-op)
- Preserve heading styles from original template

**Development:** Blue container (CT190) only

### Phase 1.7: Generation Progress UX
**Objective:** Better feedback during long-running chunked generation

**Tasks:**
- Progress indicator showing chunk completion (e.g. "Generating section 3 of 13...")
- WebSocket or polling endpoint for generation status
- Estimated time remaining
- Cancel generation mid-run

---

## Prioritized Backlog

### High Priority
- **Generation progress UX** (Phase 1.7) — chunked runs take 2-4 min with no feedback
- **Word/PDF export** (Phase 1.6) — core deliverable
- **Authentication** — Authentik OAuth2/OIDC, protected routes, user sessions
  - ⚠️ **Revision History author name** currently hardcoded to `full_name` of DB user ID 1 (`"TIP Generator Admin"`). Once auth is wired, `author_name` will pull from the logged-in user automatically — no code change needed, just real user records in the DB.
- **Excel parser tuning** — validate against real discovery workbooks, handle edge cases (merged cells, dropdowns, nested tables)

### Medium Priority
- **Draft management** — delete drafts, rename, duplicate
- **Generation history** — track which documents/template version produced each draft
- **Template Claude instructions** — add `[CLAUDE: ...]` markers to actual template .docx and verify they're picked up
- **Prompt quality iteration** — review first real TIP output and refine prompts
- **Gap/suggestion report** — explicit section listing all `[DATA NEEDED:]` placeholders found in the generated TIP

### Low Priority
- **Multi-user support** — user management, role-based permissions, draft sharing
- **Batch processing** — generate multiple TIPs from a queue
- **Template library** — multiple named templates, select per generation
- **Analytics** — token usage tracking, generation time, cost estimation
- **API tests** — pytest suite for all endpoints
- **E2E tests** — Playwright workflow tests

---

## Known Issues / Watch Items
- Chunked generation has no UI progress feedback (Phase 1.7)
- AI Assist was silently timing out (sync Claude call blocking async event loop) — **fixed 2026-04-20** via ThreadPoolExecutor
- Revision History was pulling date from discovery doc instead of server date — **fixed 2026-04-20** (deterministic post-process on generation + refine)
- **Revision History author** shows `"TIP Generator Admin"` until real auth is implemented — blocked on Authentication phase
- Excel merged cells not handled (openpyxl `data_only=True` limitation)
- SSH host key churn on CT190/CT191 after Proxmox maintenance — auto-handled by SSH config now
- TIP Generator not yet registered in MCP server — tracked in PROMOTE-TO-CONTROL-PLANE.md

---

## Roadmap

### Phase 1: MVP (In Progress)
- ✅ Infrastructure, document management, template management
- ✅ Template parsing and display
- ✅ TIP generation engine (template-aware, chunked)
- ✅ Draft review + AI-assisted editing
- ⏳ Word/PDF export (1.6)
- ⏳ Generation progress UX (1.7)
- ⏳ Authentication (Authentik OAuth2/OIDC)

### Phase 2: Multi-User (Future)
- User management, role-based permissions
- Template library management
- Draft sharing and collaboration
- Audit logging

### Phase 3: Advanced Features (Future)
- AI-powered template suggestions
- Batch processing
- Advanced analytics and reporting
- Template version control
