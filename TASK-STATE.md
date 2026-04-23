# TIP Generator Task State

**Last updated:** 2026-04-23 (end-of-day — Phase 2.4 multi-document context injection complete)
**Current branch:** main
**Working on:** Post multi-doc testing / quality review

---

## Current Task
**Phase 2.4 — Multi-document context injection** — COMPLETE

### Confirmed Complete
- ✅ **Phase 2.1** — Admin dashboard
- ✅ **Phase 2.2** — TIP Library (few-shot injection, RAG-ready schema)
- ✅ **Phase 2.3** — Draft Collaboration (collaborators table, invite/remove, typeahead search, shared badge)
- ✅ **v0.6.0** — LIVE=GREEN (CT191, 10.92.3.92) | STANDBY=BLUE (CT190, 10.92.3.91)
- ✅ **AI Assist removal** — legacy chat panel removed; per-section Refine + custom mode + DocRefinePanel remain
- ✅ **Pillar template v2** — `tip_template_v2.docx` active (DB ID=3), 18 sections parsed, build script at `docs/build_tip_template.py`
- ✅ **Prompt caching** — `SYSTEM_PREAMBLE` cached (ephemeral) on all Claude calls
- ✅ **Pillar-aware generation prompt** — SYSTEM_PREAMBLE updated with Pillar structure, Site Mapping, Open Items, Approximate Timing rules
- ✅ **Export fix** — export endpoint now loads base .docx from active DB template path
- ✅ **Phase 2.4** — Multi-document context injection: `draft_documents` junction table, checkbox UI on Generate page, supplemental docs injected as `=== SUPPLEMENTAL DOCUMENT: filename ===` blocks in both single-pass and chunked generation
- ✅ **[INSTRUCTION:] parser fix** — template parser now extracts v2 template instructions; reparse endpoint added
- ✅ **Nodes synced** — both tip-blue and tip-green at `23e155e` as of 2026-04-23

### Next steps
1. **Re-test with all 4 docs** — confirm all supplemental docs reach the prompt (bug fixed: duplicate-role spill to supplemental)
2. **Quality review** — compare multi-doc TIP output (20 pages) vs single-doc (25 pages) — determine if page delta is expected or signals missing content
3. **Few-shot injection quality** — backlog: category matching, semantic similarity
4. **Excel parser tuning** — validate against real discovery workbooks (backlog)
5. **Phase 2.5 TBD** — RAG / semantic library search candidate

---

## Known Issues
- ℹ️ **2 Playwright tests skipped** — data-dependent (require existing drafts); acceptable for now.
- ℹ️ **Tests run against STANDBY** — update `qa-01:/opt/tests/tip-generator/.env.test` BASE_URL to STANDBY node before `/test-release`.
- ℹ️ **`.windsurf` symlink** — reappears as untracked after each session (local symlink, not tracked in git). Safe to ignore.

---

## Notes
- TIP Generator uses FastAPI (port 8000) + Vite/React frontend (served via nginx)
- Blue-green containers: tip-blue (CT190, 10.92.3.91), tip-green (CT191, 10.92.3.92)
- Database: tip_generator on PostgreSQL (10.92.3.21:5432)
- Domain: https://tip.cloudigan.net (LIVE=GREEN), https://blue-tip.cloudigan.net (STANDBY=BLUE)
- Auth: Authentik at auth.cloudigan.net, OIDC client `MFO9C9ynlvpoX895YRSutwCl7xBouyAy4oOjNmI9`
- E2E tests: qa-01 `/opt/tests/tip-generator/` — run with `npx playwright test`
- Deploy: `ssh tip-blue 'cd /opt/tip-generator && git pull && /opt/tip-generator/deploy.sh'`
- Current LIVE: GREEN (CT191, 10.92.3.92) — switched 2026-04-22 after v0.6.0 release
