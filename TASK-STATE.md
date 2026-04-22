# TIP Generator Task State

**Last updated:** 2026-04-22 (mid-day)  
**Current branch:** main  
**Working on:** v0.4.0 bumped + test suite fixed; ready for /release

---

## Current Task
**v0.4.0 Release Prep — TESTS PASSING, READY FOR /release**

### Recent completions (April 22, 2026)
- ✅ **v0.4.0 bumped** — retroactive bump for Phase 1.9 (draft duplicate + gap report)
- ✅ **Test suite fixed** — `global-setup` auth flow repaired; `documents.spec` selector fixed
- ✅ **26/28 tests passing** — 2 skipped (data-dependent, acceptable)
- ✅ **Both containers on latest main** — D-LOCAL-010 violation; both LIVE and STANDBY identical

### Next steps
1. **`/release`** — switch traffic (optional; both containers identical so not urgent)
2. **BYOK Claude API key** — user profile field for personal Claude API key
3. **Excel parser tuning** — validate against real discovery workbooks

---

## Known Issues
- ℹ️ **2 Playwright tests skipped** — data-dependent (require existing drafts); acceptable for now.
- ℹ️ **Tests run against LIVE only** — Authentik redirect_uri only registered for `tip.cloudigan.net`; green-tip cannot complete OAuth. See D-LOCAL-011.

---

## Exact Next Command
```
# Run /release to switch traffic (both containers identical, low risk)
# Or move to next feature: BYOK Claude API key
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
