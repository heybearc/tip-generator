# TIP Generator Task State

**Last updated:** 2026-04-22 (v0.5.1 released to LIVE)
**Current branch:** main
**Working on:** Idle — v0.5.1 live and stable

---

## Current Task
**Idle — v0.5.1 live and stable**

### Completions (April 22, 2026)
- ✅ **v0.5.0** — Library injection, AI categories, shared docs, Docker support, README rewrite
- ✅ **v0.5.1** — Library transparency: `library_examples_used` persisted on draft; purple badge in header + `📖` icon on all section headers
- ✅ **Released** — LIVE=BLUE (CT190, 10.92.3.91), STANDBY=GREEN (CT191, 10.92.3.92), both synced
- ✅ **DB migration** — `ALTER TABLE drafts ADD COLUMN library_examples_used JSONB` applied

### Next steps (backlog)
1. **Excel parser tuning** — validate against real discovery workbooks
2. **RAG phase (2.4)** — pgvector embeddings for library docs (deferred until library has content)

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
