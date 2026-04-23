# TIP Generator Plan

**Last updated:** 2026-04-22  
**Current phase:** Phase 2.3 — Draft Collaboration  
**Status:** v0.5.1 live; Phases 2.1 + 2.2 complete; starting collaboration

---

**Development Discipline:**
- 🔵 **Blue-Green Development**: Work on ONE container at a time (CT190 blue = dev, CT191 green = stable)
- 🛡️ **Database Protection**: NEVER reset/erase DB, use backwards-compatible migrations only
- 🔄 **Deployment Flow**: Dev on blue → Test → Deploy to green → Switch traffic

---

## Current Phase: Admin, Library & Collaboration

### Active Work (IN PROGRESS)
- ✅ Draft duplicate — `POST /api/generate/drafts/{id}/duplicate`
- ✅ Gap/suggestion report — `GET /api/generate/drafts/{id}/gaps` + Gaps panel in DraftViewPage
- ✅ BYOK Claude API key — per-user key, no fallback, dynamic model selector
- ✅ Dynamic OAuth redirect — `_base_url(request)` replaces hardcoded env vars
- ✅ **Phase 2.1: Admin dashboard** — Users/Docs/Drafts tabs, stats strip, role/active toggles, full model display
- ✅ **Phase 2.2: TIP Library** — `library_documents` table, upload/approve/reject/delete API, Claude auto-category, text extraction, few-shot injection at generation time, RAG-ready schema (`embedding` field reserved), `LibraryPage.tsx`
- ✅ **Phase 2.3: Draft Collaboration** — owner-locked drafts, invite-to-edit, typeahead user search, global doc visibility, shared badge in DraftsPage

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

### Phase 1.8: Authentication ✅
**Objective:** Authentik OAuth2/OIDC, protected routes, user sessions

- ✅ Authentik OIDC Authorization Code flow (FastAPI backend)
- ✅ JWT HttpOnly session cookie (60 min expiry)
- ✅ All routes protected via `ProtectedRoute` + `get_current_user` dependency
- ✅ User name + logout button in nav header
- ✅ `TEMP_USER_ID` fully removed — all endpoints scoped to authenticated user
- ✅ Released in v0.3.0 — 2026-04-21
- ⚠️ Revision History author name currently hardcoded to `"TIP Generator Admin"` — verify this resolves now that real users exist

---

## Prioritized Backlog

### High Priority
- ~~**Add production Authentik redirect URI**~~ — ✅ `https://tip.cloudigan.net/api/auth/callback` registered in Authentik provider
- ~~**PDF export**~~ — ✅ implemented (`/drafts/{id}/export/pdf`, LibreOffice headless)
- **Excel parser tuning** — validate against real discovery workbooks; merged cells ✅ handled; remaining: dropdowns, nested tables, edge cases

### Medium Priority
- ~~**Draft management** — delete drafts, rename, duplicate~~ ✅ all three complete
- ~~**Gap/suggestion report**~~ ✅ implemented (`GET /drafts/{id}/gaps` + Gaps panel)
- **Generation history** — track which documents/template version produced each draft
- ~~**BYOK Claude API key**~~ ✅ complete — no fallback; dynamic model selector
- **Admin dashboard** — user management UI, usage/cost stats, API key status per user
- **Template Claude instructions** — add `[CLAUDE: ...]` markers to actual template .docx and verify they're picked up
- **Prompt quality iteration** — review first real TIP output and refine prompts
- **Few-shot injection quality** — current impl grabs 2 most-recent approved docs blindly; no relevance scoring. Options: (a) keyword/category match against draft title + discovery doc content, (b) semantic similarity via pgvector (prerequisite: Phase 2.4 embeddings), (c) allow admin to tag library docs with technology keywords for deterministic matching. Current impl is better than nothing but will inject irrelevant examples when library grows. Revisit once library has 5+ docs.

### Low Priority
- **Multi-user support** — user management, role-based permissions, draft sharing
- **Batch processing** — generate multiple TIPs from a queue
- **Template library** — multiple named templates, select per generation
- **Analytics** — token usage tracking, generation time, cost estimation
- **API tests** — pytest suite for all endpoints
- **E2E tests** — ✅ Playwright suite live on qa-01 (`/opt/tests/tip-generator/`) — 26/28 passing (2 skipped)

---

## Known Issues / Watch Items
- ~~Chunked generation has no UI progress feedback~~ — **fixed v0.2.0** (inline progress panel + `/progress` endpoint)
- AI Assist was silently timing out (sync Claude call blocking async event loop) — **fixed 2026-04-20** via ThreadPoolExecutor
- Revision History was pulling date from discovery doc instead of server date — **fixed 2026-04-20** (deterministic post-process on generation + refine)
- **Revision History author** shows `"TIP Generator Admin"` until real auth is implemented — blocked on Phase 1.8
- ~~Excel merged cells not handled~~ — ✅ `build_merge_map()` resolves all cells in merged ranges
- SSH host key churn on CT190/CT191 after Proxmox maintenance — auto-handled by SSH config now
- ~~TIP Generator not yet registered in MCP server~~ — **resolved 2026-04-20**
- Generated docs may still contain `[DATA NEEDED: ...]` placeholders — expected, requires human review before delivery
- ~~PDF export not yet implemented~~ — ✅ done

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

### Phase 2.1: Admin Dashboard (Next up)
- User list — name, email, role, API key status (set/not set), active/inactive
- Deactivate/reactivate users (admin only)
- Role enforcement — `admin` vs `user` enforced at API level (currently implied only)
- Usage stats per user — token counts, generation count

### Phase 2.2: TIP Library ✅ COMPLETE
- Admin uploads library TIPs (Word/PDF) with metadata: title, category (e.g. "M365 Migration", "Cloud Migration")
- Globally visible, read-only for non-admins
- User contribution flow — submit a doc as library candidate → admin approves/rejects
- Generation integration — library TIPs injected as few-shot reference at generation time
- RAG-ready schema — embedding fields on `library_documents` table for future pgvector (D-LOCAL-014)

### Phase 2.3: Draft Collaboration
- Drafts editable only by owner + admins (read-only for all other users)
- Invite to collaborate — owner invites specific users by username/email to edit a draft
- Documents (uploads) globally visible — any user can use any doc as generation source material

### Phase 2.5: Playbook — Reusable Chunk Library with RAG
**Vision (D-LOCAL-021):** Evolve the library from whole-TIP few-shot examples into a **section-chunk playbook**. Thrive's standard processes live as named, tagged chunks injected at section level — so every generated TIP inherits the best-practice Thrive process for that technology.

**Generation pattern stack (target state):**
1. Constitutional rules — hard Thrive standards as generation constraints
2. Chunk injection — section-level authoritative content by technology tag ← *this phase*
3. Few-shot examples — whole-TIP style/format guidance (current)
4. Discovery documents — project-specific customer data (current)

**Work items:**
- pgvector extension on existing Postgres (no new infra needed)
- Embed library docs on upload via Voyage-3 or `text-embedding-3-small`
- Chunk-level storage: split approved TIPs by section, store with section-type + tech tags
- Retrieve top-k relevant chunks per section at generation time, inject authoritatively
- Multi-tag support on library docs (deferred from Phase 2.2 — natural fit here)
- Admin UI: promote a draft section → library chunk
- **Prerequisite:** Library must have 10+ approved docs across 3+ categories before retrieval adds signal

### Phase 3: Real-Time Collaborative Editor (D-LOCAL-022)

**Vision:** True Google Docs-style concurrent editing for TIP drafts — presence indicators, node-anchored comments, track changes, suggestion mode.

**Architecture decision:** ProseMirror JSON storage + Yjs CRDT + FastAPI WebSocket. Do NOT use HTML storage — it cannot support real-time merge or track changes without a second migration.

**Phase 3-A: Storage Migration (prerequisite, ~2 days)**
- Add `content_format` enum column to `drafts` (`markdown` | `prosemirror`)
- Migrate existing drafts on first edit (markdown → ProseMirror JSON, flip flag)
- New AI generations write ProseMirror JSON directly (one-time `markdown → JSON` conversion at generation time)
- Rewrite DOCX exporter: replace line-by-line markdown parser with ProseMirror JSON node walker
- Remove all markdown/HTML conversion hacks from `TipTapEditor.tsx` and `generate.py`

**Phase 3-B: Real-Time Sync (~2-3 days)**
- Add Yjs + y-prosemirror to frontend
- FastAPI WebSocket endpoint: `/ws/drafts/{id}`
- Presence indicators (who is editing which section)
- Cursor positions synced across users
- Last-write-wins replaced by CRDT merge (no data loss on concurrent edits)

**Phase 3-C: Comments (~1-2 days)**
- TipTap Comments extension — anchored to specific document nodes
- Comment threads: create, reply, resolve
- Comment authors + timestamps
- Visible in sidebar alongside the section being commented on

**Phase 3-D: Track Changes / Suggestions (~2-3 days)**
- Insertions/deletions marked per user (accept/reject model)
- Suggestion mode: propose edits without committing
- Owner or admin accepts/rejects suggestions
- Options: TipTap Pro track changes extension, or custom implementation

**Prerequisites before starting Phase 3:**
- Library has 10+ approved docs (for Phase 2.5 RAG to be worth doing in parallel)
- Current markdown hacks documented and isolated — do not add new ones
- Dedicated sprint — do not interleave with feature work

### Phase 3+: Advanced Features
- AI-powered template suggestions
- Batch processing
- Advanced analytics — token usage, cost per generation, cost with BYOK keys
- Template version control
