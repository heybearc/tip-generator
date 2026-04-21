# TIP Generator Plan

**Last updated:** 2026-04-20  
**Current phase:** Active refinement — export quality, generation prompt discipline  
**Status:** Phases 1.1–1.6 complete; 1.7 and Authentication next

---

**Development Discipline:**
- 🔵 **Blue-Green Development**: Work on ONE container at a time (CT190 blue = dev, CT191 green = stable)
- 🛡️ **Database Protection**: NEVER reset/erase DB, use backwards-compatible migrations only
- 🔄 **Deployment Flow**: Dev on blue → Test → Deploy to green → Switch traffic

---

## Current Phase: Export Quality + Generation Discipline

### Active Work (IN PROGRESS)
- ⏳ Generation progress UX (Phase 1.7)
- ⏳ Authentication (Authentik OAuth2/OIDC)

---

## Completed Phases

**Phase 1.1: Infrastructure & Deployment** ✅
- ✅ Blue-green containers (CT190 @ 10.92.3.91, CT191 @ 10.92.3.92)
- ✅ HAProxy + NPM + SSL, shared PostgreSQL + NFS
- ✅ FastAPI backend + React/Vite frontend deployed
- ✅ tip-generator registered in blue-green MCP server

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

**Phase 1.6: TIP Export** ✅
- ✅ Word (.docx) export — loads Thrive template, inherits header/footer/styles
- ✅ Proper Word Heading 1/2/3 styles (all-caps, #143F6A, Calibri) from template
- ✅ Real Word XML bullet lists (abstractNum/numPr) via List Paragraph style
- ✅ Numbered lists with proper hanging indent
- ✅ 4-column risk tables with teal header row
- ✅ `[INSTRUCTION: ...]` blocks stripped on export
- ✅ Document Control Notice and Service Order callout stripped on export
- ✅ Bullet spacing (space before/after) for readability
- ✅ Export formatting lessons saved to Cascade memory

**Phase 1.6+: Generation Prompt Discipline** ✅
- ✅ No Risk Register section (not in template)
- ✅ No Service Order callout block in generated output
- ✅ Implementation Details: numbered steps/bullets; Option A/B only when genuinely multiple approaches exist
- ✅ All table section formats enforced (Risks 4-col, Acceptance Criteria 3-col, Deliverables 4-col)
- ✅ Appendix A = N/A for project TIPs; Appendix B = risk reference
- ✅ DB instruction override for Implementation Details matches template instruction exactly
- ✅ Post-generation restructure tooling built (collapse Risk/Test blocks, Step sub-headings → numbered lists)

---

## Upcoming Phases

### Phase 1.7: Generation Progress UX ✅
**Objective:** Better feedback during long-running chunked generation

- ✅ `GET /api/generate/drafts/{id}/progress` lightweight polling endpoint
- ✅ Inline progress panel on GeneratePage (no redirect) — polls every 2s
- ✅ Progress bar shows batch X of Y (Claude API calls), token count
- ✅ Auto-navigates to draft on completion
- ✅ Released in v0.2.0 — 2026-04-21

### Phase 1.8: Authentication
**Objective:** Authentik OAuth2/OIDC, protected routes, user sessions

**Notes:**
- ⚠️ Revision History author name currently hardcoded to `"TIP Generator Admin"` — will resolve automatically once real user records exist in DB post-auth

---

## Prioritized Backlog

### High Priority
- **Authentication** (Phase 1.8) — Authentik OAuth2/OIDC, protected routes, user sessions
- **PDF export** — convert docx to PDF (LibreOffice headless or WeasyPrint)
- **Excel parser tuning** — validate against real discovery workbooks, handle edge cases (merged cells, dropdowns, nested tables)

### Medium Priority
- **Draft management** — delete drafts, rename, duplicate
- **Generation history** — track which documents/template version produced each draft
- **BYOK Claude API key** — user profile field for personal Claude API key; generation uses it if set, falls back to system key
- **Admin dashboard** — user management UI, usage/cost stats, API key status per user
- **Template Claude instructions** — add `[CLAUDE: ...]` markers to actual template .docx and verify they're picked up
- **Prompt quality iteration** — review first real TIP output and refine prompts
- **Gap/suggestion report** — explicit section listing all `[DATA NEEDED:]` placeholders found in the generated TIP

### Low Priority
- **Multi-user support** — user management, role-based permissions, draft sharing
- **Batch processing** — generate multiple TIPs from a queue
- **Template library** — multiple named templates, select per generation
- **Analytics** — token usage tracking, generation time, cost estimation
- **API tests** — pytest suite for all endpoints
- **E2E tests** — ✅ Playwright suite live on qa-01 (`/opt/tests/tip-generator/`) — 26/26 passing

---

## Known Issues / Watch Items
- ~~Chunked generation has no UI progress feedback~~ — **fixed v0.2.0** (inline progress panel + `/progress` endpoint)
- AI Assist was silently timing out (sync Claude call blocking async event loop) — **fixed 2026-04-20** via ThreadPoolExecutor
- Revision History was pulling date from discovery doc instead of server date — **fixed 2026-04-20** (deterministic post-process on generation + refine)
- **Revision History author** shows `"TIP Generator Admin"` until real auth is implemented — blocked on Phase 1.8
- Excel merged cells not handled (openpyxl `data_only=True` limitation)
- SSH host key churn on CT190/CT191 after Proxmox maintenance — auto-handled by SSH config now
- ~~TIP Generator not yet registered in MCP server~~ — **resolved 2026-04-20**
- Generated docs may still contain `[DATA NEEDED: ...]` placeholders — expected, requires human review before delivery
- PDF export not yet implemented — docx only for now

---

## Roadmap

### Phase 1: MVP (In Progress)
- ✅ Infrastructure, document management, template management
- ✅ Template parsing and display
- ✅ TIP generation engine (template-aware, chunked)
- ✅ Draft review + AI-assisted editing
- ✅ Word export — template-faithful, proper heading styles, bullets, tables (1.6)
- ✅ Generation prompt discipline — no hallucinated structure, correct table formats (1.6+)
- ⏳ Generation progress UX (1.7)
- ⏳ Authentication — Authentik OAuth2/OIDC (1.8)
- ⏳ PDF export

### Phase 2: Admin & Multi-User (Future)
- **User management** — create/edit/deactivate users, role-based permissions (Admin, Editor, Viewer)
- **User profile settings** — display name, email, preferences
- **BYOK (Bring Your Own Key)** — each user can store their own Claude API key in their profile; generation uses the logged-in user's key, falling back to the system key if none set
- **Template library management** — multiple named templates, select per generation
- **Draft sharing and collaboration** — share drafts between users
- **Audit logging** — who generated/edited/exported what and when
- **Admin dashboard** — user list, usage stats, API key status per user

### Phase 3: Advanced Features (Future)
- AI-powered template suggestions
- Batch processing
- Advanced analytics and reporting (token usage, cost per generation, estimated cost with BYOK keys)
- Template version control
- Gap/suggestion report — auto-list all `[DATA NEEDED:]` placeholders in a generated TIP
