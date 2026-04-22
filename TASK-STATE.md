# TIP Generator Task State

**Last updated:** 2026-04-22 (Phase 2.2 confirmed complete)
**Current branch:** main
**Working on:** Phase 2.3 — Draft Collaboration

---

## Current Task
**Phase 2.3 — Draft Collaboration (starting)**

### Confirmed Complete
- ✅ **Phase 2.1** — Admin dashboard (Users/Docs/Drafts tabs, stats, role/active toggles)
- ✅ **Phase 2.2** — TIP Library (`library_documents` table, upload/approve/reject/delete, Claude auto-category, text extraction, few-shot injection, `LibraryPage.tsx`, RAG-ready schema)
- ✅ **v0.5.0 / v0.5.1** — Library injection, purple badge, `library_examples_used` persisted
- ✅ **LIVE=BLUE** (CT190, 10.92.3.91) | STANDBY=GREEN (CT191, 10.92.3.92)

### Next steps
1. **Phase 2.3: Draft Collaboration** — owner-locked drafts, invite-to-edit, global doc visibility
2. **Excel parser tuning** — validate against real discovery workbooks (backlog)

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
- Current LIVE: BLUE (CT190, 10.92.3.91) — switched 2026-04-22 after v0.5.1 release
