# TIP Generator Task State

**Last updated:** 2026-04-22 (mid-day, admin dashboard deployed)  
**Current branch:** main  
**Working on:** Phase 2.1 complete — next: Phase 2.2 TIP Library

---

## Current Task
**Phase 2.1 Admin Dashboard — COMPLETE**

### Recent completions (April 22, 2026)
- ✅ **Auth 403 fix** — `_base_url()` was forcing `http://` redirect_uri; committed fix that was local-only; deployed to both containers
- ✅ **Admin dashboard** — `/admin/users` with Users/Documents/Drafts tabs, stats strip, role/active toggles
- ✅ **Admin backend** — `/api/admin/users`, `/api/admin/stats`, `/api/admin/documents`, `/api/admin/drafts` endpoints
- ✅ **Model display fixed** — full model ID shown (no more truncation)
- ✅ **Both containers on `14ba01a`** — BLUE via MCP deploy, GREEN via git pull + build

### Next steps
1. **Phase 2.2: TIP Library** — admin-managed, globally visible, few-shot injection, RAG-ready schema
2. **Excel parser tuning** — validate against real discovery workbooks
3. **Prompt quality iteration** — review first real TIP and refine

---

## Known Issues
- ℹ️ **2 Playwright tests skipped** — data-dependent (require existing drafts); acceptable for now.
- ℹ️ **Tests run against STANDBY** — new features deploy to STANDBY first; tests validate before `/release`. All three Authentik redirect URIs registered. See D-LOCAL-011.
- ℹ️ **Next test cycle** — update `qa-01:/opt/tests/tip-generator/.env.test` BASE_URL to point at STANDBY node before running `/test-release`. No container `.env` changes needed (dynamic OAuth redirect).

---

## Exact Next Command
```
# Next: admin dashboard or excel parser tuning
# Admin dashboard: user list, deactivate, claude_api_key status
# Excel parser: test against real discovery workbook
```

---

## Notes
- TIP Generator uses FastAPI (port 8000) + Vite/React frontend (served via nginx)
- Blue-green containers: tip-blue (CT190, 10.92.3.91), tip-green (CT191, 10.92.3.92)
- Database: tip_generator on PostgreSQL (10.92.3.21:5432)
- Domain: https://tip.cloudigan.net (LIVE), https://blue-tip.cloudigan.net (blue), https://green-tip.cloudigan.net (green)
- Auth: Authentik at auth.cloudigan.net, OIDC client `MFO9C9ynlvpoX895YRSutwCl7xBouyAy4oOjNmI9`
- E2E tests: qa-01 `/opt/tests/tip-generator/` — run with `npx playwright test`
- Deploy: `ssh tip-blue 'cd /opt/tip-generator && git pull && /opt/tip-generator/deploy.sh'`
- Current LIVE: GREEN (CT191, 10.92.3.92) — after v0.5.0 /release on 2026-04-22
- OAuth redirect_uri and frontend_url now derived dynamically from request host (no .env dependency)
