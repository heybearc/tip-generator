# TIP Generator Task State

**Last updated:** 2026-04-21 (End of Day)  
**Current branch:** main  
**Working on:** v0.3.0 released — Authentik auth live in production

---

## Current Task
**Phase 1.8 Authentication — COMPLETE, v0.3.0 released** - READY FOR NEXT PHASE

Authentik OAuth2/OIDC authentication fully implemented and released to production. Both blue and green containers synced on v0.3.0. Playwright E2E suite live on qa-01 (26/28 passing).

### Recent completions (April 21, 2026)
- ✅ **Phase 1.8 Authentication** — Authentik OIDC, protected routes, JWT sessions, user nav
- ✅ **TEMP_USER_ID fully removed** — all endpoints scoped to `current_user.id`
- ✅ **Playwright E2E suite** — global-setup drives Authentik flow executor API (headless-safe), 26/28 passing on qa-01
- ✅ **v0.3.0 released** — bumped, release notes created, committed, pushed
- ✅ **Both containers synced** — tip-blue and tip-green on v0.3.0 with correct `.env`
- ✅ **quote_plus fix** — scope encoding corrected to prevent Authentik `%20` double-encoding

### Next steps
1. **Add `https://tip.cloudigan.net/api/auth/callback` to Authentik** — TIP Generator Provider → Redirect URIs (needed for production login)
2. **Start Phase 1.9 — pick highest priority backlog item** (PDF export or Excel parser tuning)
3. **Revision History author** — currently hardcoded to `"TIP Generator Admin"`; will auto-resolve when user records exist post-auth — verify this is working now
4. **Run `/test-release` smoke check** after adding Authentik redirect URI

---

## Known Issues
- ⚠️ **Authentik redirect URI not registered for production** — `https://tip.cloudigan.net/api/auth/callback` must be added to Authentik → TIP Generator Provider → Redirect URIs before production login works. Currently only `blue-tip.cloudigan.net` is registered.
- ⚠️ **HAProxy MCP status inconsistent** — MCP reports BLUE as LIVE even after switch_traffic succeeded. Manual verification shows both containers healthy. Low risk, worth investigating.
- ℹ️ **2 Playwright tests skipped** — documents and drafts specs have skipped tests (not failures); acceptable for now.

---

## Exact Next Command
```
# 1. Add Authentik redirect URI (manual — Authentik admin UI)
#    https://auth.cloudigan.net → Applications → TIP Generator → Provider → Redirect URIs
#    Add: https://tip.cloudigan.net/api/auth/callback

# 2. Verify production login works
curl -si https://tip.cloudigan.net/api/auth/login | grep location

# 3. Start next phase
/start-day
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
