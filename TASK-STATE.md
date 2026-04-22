# TIP Generator Task State

**Last updated:** 2026-04-22 (v0.6.0 released — Phase 2.3 complete)
**Current branch:** main
**Working on:** Phase 2.4 (TBD)

---

## Current Task
**Idle — awaiting next phase direction**

### Confirmed Complete
- ✅ **Phase 2.1** — Admin dashboard
- ✅ **Phase 2.2** — TIP Library (few-shot injection, RAG-ready schema)
- ✅ **Phase 2.3** — Draft Collaboration (collaborators table, invite/remove, typeahead search, shared badge)
- ✅ **v0.6.0** — LIVE=GREEN (CT191, 10.92.3.92) | STANDBY=BLUE (CT190, 10.92.3.91)

### Next steps
1. **Phase 2.4** — TBD
2. **Few-shot injection quality** — backlog: category matching, semantic similarity (see PLAN.md)
3. **Excel parser tuning** — validate against real discovery workbooks (backlog)

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
