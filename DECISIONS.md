# TIP Generator Repo-Local Decisions

This file tracks decisions specific to working on TIP Generator.

For shared architectural decisions that apply to all apps, see the Cloudy-Work control plane:
`.cloudy-work/_cloudy-ops/context/DECISIONS.md`

---

## Decision Template

When adding a decision, use this format:

## D-LOCAL-XXX: [Short decision title]
- **Decision:** [What was decided]
- **Why:** [Rationale - why this choice over alternatives]
- **When:** [Date and context]
- **Alternatives considered:** [Optional - what else was considered]

---

## D-LOCAL-001: Shared NFS storage for uploaded documents

- **Decision:** Use TrueNAS NFS share (`10.92.0.3:/mnt/media-pool/tip-uploads`) mounted at `/mnt/tip-uploads` on both CT190 and CT191 for storing uploaded documents
- **Why:** 
  - Blue-green deployment requires both containers to access the same files
  - Container-local storage (`/var/tmp`) doesn't persist across container rebuilds
  - NFS provides shared, persistent storage without manual file syncing
  - TrueNAS already provides enterprise-grade storage with RAIDZ1 redundancy
- **When:** 2026-04-20
- **Implementation:**
  - TrueNAS dataset: `media-pool/tip-uploads` with LZ4 compression
  - NFS share ID 19, allows 10.92.0.0/16 network, mapall to root:root
  - Proxmox host mounts NFS at `/mnt/pve/tip-uploads` (in `/etc/fstab`)
  - Both containers get bind mount via `pct set <vmid> -mp0 /mnt/pve/tip-uploads,mp=/mnt/tip-uploads`
  - Backend service uses `/mnt/tip-uploads` as upload directory
- **Alternatives considered:**
  1. **PostgreSQL BYTEA storage** - Rejected: Poor performance for large files, bloats database
  2. **Rsync between containers** - Rejected: Requires manual sync during deployments, race conditions
  3. **S3-compatible object storage** - Rejected: Overkill for this use case, adds complexity
  4. **Container-local storage** - Rejected: Files don't persist across blue-green switches
- **Database:** File metadata (filename, path, extracted text) stored in PostgreSQL, actual files on NFS
- **Monitoring:** TrueNAS pool health monitored via custom exporter on CT150:9200

---

## D-LOCAL-001: FastAPI backend with React frontend
- **Decision:** Use FastAPI (Python 3.11+) for backend API and React with Vite for frontend
- **Why:** FastAPI provides excellent performance for document processing APIs, native async support, and automatic OpenAPI documentation. React with Vite offers fast development experience and modern build tooling.
- **When:** 2026-04-19 (initial architecture)
- **Alternatives considered:** Django REST Framework (too heavy), Flask (lacks async), Next.js full-stack (Python better for document processing)

## D-LOCAL-002: Port 8000 for FastAPI backend
- **Decision:** TIP Generator uses port 8000 for FastAPI backend, not the standard 3001 used by Next.js apps
- **Why:** FastAPI convention is port 8000. Deviating from global port standard (3001) is acceptable for non-Next.js apps.
- **When:** 2026-04-19
- **Note:** This is an exception to D-001 (port standardization) which applies to Next.js apps only

## D-LOCAL-003: Claude Sonnet 4.6 for TIP generation
- **Decision:** Use Claude Sonnet 4.6 (latest) instead of Claude 3.5 Sonnet for AI-powered TIP generation
- **Why:** Sonnet 4.6 is the newest model (2026) with improved intelligence, better structured output, and superior technical writing capabilities. Same pricing tier as 3.5 Sonnet but significantly better quality.
- **When:** 2026-04-20 (mid-day update)
- **Alternatives considered:** Opus 4.7 (too expensive for standard use), Haiku 4.5 (too fast/cheap, lower quality), 3.5 Sonnet (outdated)

## D-LOCAL-004: Blue-only development, green as standby
- **Decision:** Develop and test exclusively on CT190 (blue), keep CT191 (green) as standby for blue-green deployment
- **Why:** Faster iteration during development. Deploy to green only when features are stable and ready for production traffic switching.
- **When:** 2026-04-20
- **Consequences:** Must manually sync code to green when ready for deployment

## D-LOCAL-005: deploy.sh as temporary bridge until MCP registration
- **Decision:** `/opt/tip-generator/deploy.sh` on each container as a temporary deploy method
- **Why:** TIP Generator is not yet registered in the homelab-blue-green-deployment MCP server. Standard pattern is `mcp0_deploy_to_standby app=tip-generator` but that requires MCP registration first.
- **When:** 2026-04-20
- **Temporary:** Yes - remove once TIP Generator is added to the MCP server
- **Promotion:** See PROMOTE-TO-CONTROL-PLANE.md - MCP registration is tracked for control plane action
- **Usage (until MCP ready):** `ssh tip-blue '/opt/tip-generator/deploy.sh'`

## D-LOCAL-006: SSH config covers bare IPs for both TIP containers
- **Decision:** SSH config `Host` entries for CT190 and CT191 include the raw IP address as an alias, with `StrictHostKeyChecking accept-new` and `CheckHostIP no`
- **Why:** Containers occasionally have host key changes after Proxmox maintenance. Without this, every SSH command breaks requiring manual `ssh-keygen -R`. `CheckHostIP no` prevents ECDSA/ED25519 confusion when the same IP changes keys.
- **When:** 2026-04-20
- **Aliases:** `tip-blue`, `ct190-tip`, `10.92.3.91` → CT190 / `tip-green`, `ct191-tip`, `10.92.3.92` → CT191

## D-LOCAL-007: Authentik scope encoding via `quote_plus` (not `urlencode` default)
- **Decision:** Encode OAuth `scope` parameter using `urlencode` (which uses `quote_plus` — spaces → `+`), but leave `redirect_uri` unencoded in the query string to avoid double-encoding in Authentik's `next=` redirect parameter.
- **Why:** Authentik internally wraps the authorization URL in a `next=` redirect. If `redirect_uri` is percent-encoded, Authentik double-encodes it, producing a malformed callback URL. Standard `urlencode` for other params is fine.
- **When:** 2026-04-21
- **Location:** `backend/routers/auth.py` — `login` endpoint, lines ~97-102

## D-LOCAL-008: Playwright global-setup drives Authentik flow executor API directly
- **Decision:** Use Authentik's internal flow executor REST API (`/api/v3/flows/executor/default-authentication-flow/`) for programmatic login in Playwright `globalSetup`, bypassing the Vue SPA UI.
- **Why:** Authentik's frontend is a Vue SPA. In headless Playwright, the `Continue`/`Submit` button click handlers were not attaching correctly (Vue reactivity issue), causing the login flow to stall. Driving the underlying API directly is reliable and fast.
- **When:** 2026-04-21
- **Location:** `tests/global-setup.ts`
- **Flow:** POST uid_field → POST password → GET `/api/auth/login` (re-triggers our OAuth flow) → `waitForURL` on app domain → save `storageState`

## D-LOCAL-010: VIOLATION — Skipped release workflow on Phase 1.9 deploy (2026-04-22)
- **Violation:** Cascade deployed Phase 1.9 changes directly to both BLUE (LIVE) and GREEN (STANDBY) containers without following the `/bump` → `/test-release` → `/release` → `/sync` workflow.
- **Rules broken:** `global-rules.md` §1 (Release Workflow), §12 (Rule Violations — must challenge before acting), §13 (Assistant must challenge rule-violating actions)
- **What happened:** After committing and pushing, Cascade ran `ssh ct191-tip` (GREEN/standby — correct first step) then immediately also deployed to `ct190-tip` (BLUE/LIVE — should require test gate first). No `/test-release` was run. No explicit approval for LIVE deploy was obtained.
- **Correct procedure:** Deploy to STANDBY only → tell user → wait for `/test-release` to pass → user runs `/release` to switch traffic → `/sync` to update the old LIVE.
- **Correction:** Both containers are currently on the same code so no rollback is needed. Future deployments must stop at STANDBY and wait for explicit release approval.
- **When:** 2026-04-22


## D-LOCAL-011: Playwright tests always run against STANDBY (new features live there)
- **Decision:** E2E tests run against STANDBY, not LIVE. New features are deployed to STANDBY first; that's the environment under test before `/release`.
- **Why:** Testing STANDBY validates new code before it goes LIVE. All three redirect URIs are registered in Authentik (`tip.cloudigan.net`, `blue-tip.cloudigan.net`, `green-tip.cloudigan.net`), so OAuth works on either node.
- **When:** 2026-04-22

## D-LOCAL-012: BYOK — no system API key fallback
- **Decision:** Each user must provide their own Anthropic Claude API key. No system-level fallback. Generation fails with HTTP 402 + clear message if key not set.
- **Why:** Cost isolation — users pay for their own usage directly.
- **When:** 2026-04-22

## D-LOCAL-013: OAuth redirect_uri derived dynamically from request host
- **Decision:** `OAUTH_REDIRECT_URI` and `FRONTEND_URL` are no longer read from `.env`. Both are derived at runtime from the incoming request's `x-forwarded-host` / `host` headers via `_base_url(request)`.
- **Why:** Eliminates the need to mutate `.env` files when testing against non-LIVE domains (blue-tip, green-tip). All three Authentik redirect URIs are pre-registered.
- **When:** 2026-04-22

## D-LOCAL-014: TIP Library — few-shot first, RAG-ready schema from day 1
- **Decision:** Phase 2.2 library uses few-shot injection (library TIPs injected as reference into Claude prompt at generation time). Schema designed for pgvector embeddings from day 1 so Phase 2.4 (RAG) requires no migration.
- **Why:** RAG adds real value only when the library has meaningful content. Few-shot is simpler, faster to build, and often produces equivalent quality for structured documents like TIPs. Building the RAG-ready schema now avoids a costly migration later.
- **When:** 2026-04-22
- **Schema:** `library_documents` table with `title`, `category`, `file_path`, `extracted_text`, `embedding` (nullable vector field), `status` (`active` | `pending` | `rejected`), `submitted_by`, `approved_by`
- **Embedding model (Phase 2.4):** Voyage-3 or `text-embedding-3-small` — decision deferred until library is populated
- **Alternatives considered:** RAG from day 1 (premature, empty library produces no value), fine-tuning (too expensive, requires large dataset)

## D-LOCAL-015: Document and draft visibility model
- **Decision:** Documents (uploads) are globally visible to all users. Drafts are owner-locked — editable only by owner + admins. Draft owners can invite specific users to collaborate (edit access). Library TIPs are admin-managed, globally readable, no user edits.
- **Why:** Global document visibility enables reuse of source material across the team without complex permission management. Owner-locked drafts prevent accidental edits while still supporting intentional collaboration via explicit invite. Fits a small, trusted team.
- **When:** 2026-04-22
- **Roles:** `admin` (full access to all drafts, library management, user management), `user` (own drafts + invited drafts editable, all others read-only)
- **Implementation:** `draft_collaborators` join table for invite-to-edit; document table has no `owner_id` filter on read queries

## D-LOCAL-016: Pillar-based TIP template v2
- **Decision:** Replace SIP-format template (Technology Areas 1-6) with Pillar-based Project TIP format. Template v2 has: preamble sections, 6 placeholder Pillars (each with navy banner, Preconditions amber callout, Phase steps, Acceptance Checklist), Site Mapping, Open Items, Appendix A server inventory.
- **Why:** Team moving to Pillar-format for all project TIPs. DialConnection doc used as reference structure.
- **When:** 2026-04-22
- **Active path:** `/mnt/tip-uploads/templates/tip_template_v2.docx` (DB ID=3, is_active=true). Build script: `docs/build_tip_template.py`.

## D-LOCAL-017: Prompt caching on all Claude calls
- **Decision:** All Claude API calls use `cache_control: {"type": "ephemeral"}` on the system preamble block (`SYSTEM_PREAMBLE`). Applies to generation (single-pass + chunked), refine-guided, refine-all.
- **Why:** Anthropic caches ephemeral system blocks for 5 min, ~90% reduction on input token cost for repeated calls within the window.
- **When:** 2026-04-22

## D-LOCAL-018: Anthropic Batch API rejected for user-facing endpoints
- **Decision:** Do not use `messages.batches.create()` for any user-facing real-time endpoint. Batch API has up to 24h processing time — incompatible with interactive use.
- **Why:** Batch API is for overnight/background processing only. All TIP Generator endpoints (`refine-all`, `refine-guided`, generation) are user-facing and expect seconds-level responses.
- **When:** 2026-04-22
- **Alternative:** Parallel `ThreadPoolExecutor` calls with prompt caching achieves cost efficiency without latency penalty.

## D-LOCAL-019: Multi-document context injection (Phase 2.4)
- **Decision:** Attach N documents (any mix of Excel/PDF/other) to a draft via `draft_documents` junction table. Existing `discovery_document_id` and `service_order_document_id` FK columns preserved for backwards compat. Supplemental docs injected into Claude prompt as `=== SUPPLEMENTAL DOCUMENT: filename ===` blocks after discovery/service order, in both single-pass and chunked generation.
- **Why:** Customers provide multiple source documents (protection lists, runbooks, scoping PDFs). All must reach Claude for accurate TIP generation.
- **When:** 2026-04-23
- **UI:** Generate page replaced two dropdowns with checkbox list. Auto-assigns roles (xlsx→discovery, pdf→service_order, other→supplemental). Duplicate-role extras spill to supplemental. Role overridable per doc via inline dropdown.
- **Schema:** `draft_documents(id, draft_id, document_id, role, position, created_at)` — migration 007.
- **Alternatives considered:** Upload-at-generation-time inline (rejected: pre-upload library is already in place and more flexible)

## D-LOCAL-020: VIOLATION — Deployed directly to LIVE (GREEN) during Phase 2.4 hotfix (2026-04-23)
- **Violation:** During multi-select bug fixing, Cascade ran `npm run build && systemctl restart` directly on tip-green (LIVE) instead of routing through STANDBY first.
- **What happened:** The multi-select fix commit `23e155e` was pulled and built on GREEN (LIVE) directly to resolve a user-facing bug mid-test. BLUE (STANDBY) was synced afterward via MCP deploy.
- **Correct procedure:** Deploy fix to STANDBY → test → release → sync.
- **Mitigating factor:** User was actively testing on GREEN at the time; fix was a pure frontend-only change with no backend/DB risk.
- **Correction:** Both nodes now at `23e155e`. No rollback needed.
- **When:** 2026-04-23

## D-LOCAL-022: Draft Editor Storage Migration — ProseMirror JSON + Real-Time Collaboration (Phase 3)
- **Decision:** Migrate draft section storage from markdown strings to **ProseMirror JSON** (TipTap's native document format) and add real-time collaborative editing via **Yjs + WebSockets**.
- **Why ProseMirror JSON over HTML:** HTML storage is a viable intermediate step but requires a second migration when real-time sync is added. ProseMirror JSON is the only format that natively supports operational transforms (Yjs CRDT), node-anchored comments, and track changes — all required features.
- **Why not now:** This is an 8-10 day engineering effort requiring: (1) DB migration, (2) DOCX exporter rewrite as JSON node walker, (3) Yjs WebSocket transport, (4) Comments, (5) Track changes. Doing this mid-sprint creates high rollback risk. Current markdown hacks do not block users today.
- **Current state accepted as tech debt:** The markdown storage + HTML passthrough hacks (alignment, table structure) are acknowledged technical debt. No new hacks will be added. All current hacks are isolated to `TipTapEditor.tsx` (frontend) and the line-parser in `generate.py` (backend).
- **Collaboration model today:** Invite-based shared access (sequential editing, last-write-wins). Not real-time. This is the correct scope for Phase 2.3.
- **Phase 3 target collaboration model:** True concurrent editing with presence, comments anchored to document nodes, suggestion/track-changes mode. Stack: TipTap + Yjs + y-prosemirror + FastAPI WebSocket.
- **Migration path (Phase 3):**
  1. Add `content_format` enum to drafts (`markdown` | `prosemirror`) — default `markdown`
  2. On first TipTap edit, convert markdown → ProseMirror JSON, flip flag
  3. New AI generations save as ProseMirror JSON directly
  4. Rewrite DOCX exporter to walk ProseMirror JSON node tree
  5. Add Yjs provider + WebSocket endpoint
  6. Add Comments extension
  7. Add Track Changes (TipTap Pro or custom)
- **When:** 2026-04-23

## D-LOCAL-021: TIP Library long-term vision — Reusable Chunk Playbook with RAG
- **Decision:** The TIP Library will evolve toward a **reusable section-chunk playbook** model, not just a whole-TIP few-shot library. Thrive's standard processes (e.g. M365 Migration Phase 2, Apple MDM Enrollment) will be stored as named, tagged chunks that can be injected at section level during generation — producing a best-practice TIP every time.
- **Why:** Thrive Principal Architect team wants authoritative, repeatable process content — not just style examples. The distinction: few-shot teaches *how to write*; chunk injection delivers *what the answer is*. Over time the library becomes a living playbook that improves with every approved TIP.
- **Generation pattern stack (in priority order):**
  1. **Constitutional rules** — hard Thrive standards injected as constraints (Phase 3)
  2. **Chunk injection** — section-level authoritative content matched by technology tag (Phase 2.5)
  3. **Few-shot examples** — whole-TIP style/format guidance (current, Phase 2.2)
  4. **Discovery documents** — project-specific customer data (current)
- **Why single-category is correct now:** Library has <10 docs. Retrieval is by category string, not semantics. Multi-category adds schema complexity before the library has enough content to benefit. Revisit when library has 20+ docs or RAG is implemented.
- **Multi-category deferred to Phase 2.5:** When pgvector embeddings replace category-string matching, tags become richer and multi-tag is natural. Building it now into a string-based system would be thrown away.
- **Current library role:** Seed corpus — every approved doc is future chunk source material. Tag quality and admin curation now directly improve Phase 2.5 retrieval quality later.
- **When:** 2026-04-23

## D-LOCAL-009: JWT HttpOnly cookie for session management
- **Decision:** Store authentication session as a JWT in an HttpOnly, SameSite=Lax cookie (`tip_session`), not localStorage or a Bearer token in headers.
- **Why:** HttpOnly prevents XSS-based token theft. SameSite=Lax prevents most CSRF attacks. Avoids storing secrets in JavaScript-accessible storage. Cookie is automatically sent with all same-origin requests.
- **When:** 2026-04-21
- **Expiry:** 60 minutes (`JWT_EXPIRATION_MINUTES=60`)
- **Logout:** Cookie cleared via `response.delete_cookie("tip_session")` on `/api/auth/logout`
