# TIP Generator Task State

**Last updated:** 2026-04-22 (v0.5.0 tagged, STANDBY testing in progress)
**Current branch:** main
**Working on:** v0.5.0 on STANDBY (tip-blue CT190) — awaiting manual test pass before `/release`

---

## Current Task
**v0.5.0 — Awaiting release decision**

### Recent completions (April 22, 2026)
- ✅ **TIP Library few-shot injection** — approved library docs injected into Claude prompt
- ✅ **AI-suggested categories** — Claude suggests category on upload if omitted; inline edit for admins
- ✅ **Shared documents** — user ID 1 docs visible/usable by all users in generate flow
- ✅ **Docker support** — `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` + nginx
- ✅ **README rewrite** — public-safe, self-hosting guide, architecture diagram
- ✅ **v0.5.0 tagged** — git tag pushed, version bumped in `main.py`
- ✅ **Repo cleanup** — client `.docx` files removed from tracking, `.windsurf` symlink untracked

### Next steps
1. **Manual test on STANDBY** — verify shared docs, AI category suggestion, generate flow
2. **`/release`** — switch traffic GREEN → BLUE once test passes
3. **`/sync`** — sync GREEN with latest after release
4. **Excel parser tuning** — validate against real discovery workbooks (backlog)

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
- Current LIVE: GREEN (CT191, 10.92.3.92)
