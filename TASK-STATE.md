# TIP Generator Task State

**Last updated:** 2026-04-22 (mid-day, post-release)  
**Current branch:** main  
**Working on:** v0.4.0 released — next: BYOK Claude API key

---

## Current Task
**v0.4.0 RELEASED — Starting BYOK Claude API key feature**

### Recent completions (April 22, 2026)
- ✅ **v0.4.0 bumped** — retroactive bump for Phase 1.9 (draft duplicate + gap report)
- ✅ **Test suite fixed** — `global-setup` auth flow repaired; `documents.spec` selector fixed
- ✅ **26/28 tests passing** — 2 skipped (data-dependent, acceptable)
- ✅ **v0.4.0 deployed** — BLUE (LIVE), GREEN (STANDBY) both on v0.4.0; traffic on BLUE
- ✅ **`/release` + `/sync` complete** — both containers synced

### Next steps
1. **BYOK Claude API key** — user profile field for personal Claude API key; falls back to system key
2. **Excel parser tuning** — validate against real discovery workbooks
3. **Admin dashboard** — user mgmt, usage/cost stats

---

## Known Issues
- ℹ️ **2 Playwright tests skipped** — data-dependent (require existing drafts); acceptable for now.
- ℹ️ **Tests run against LIVE only** — Authentik redirect_uri only registered for `tip.cloudigan.net`; green-tip cannot complete OAuth. See D-LOCAL-011.

---

## Exact Next Command
```
# Start BYOK feature: add claude_api_key field to user profile
# Backend: PATCH /api/users/me/profile, store encrypted in DB
# Frontend: Profile settings page with API key input
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
- MCP `deploy_to_standby` is INCOMPATIBLE — app has no root `package.json` (FastAPI+Vite); use manual SSH deploy (see D-LOCAL-012)
- Current LIVE: BLUE (CT190, 10.92.3.91) — after /release on 2026-04-22
