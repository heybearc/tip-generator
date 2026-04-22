# TIP Generator Task State

**Last updated:** 2026-04-22  
**Current branch:** main  
**Working on:** Phase 1.9 — Draft management + gap report complete, deployed to both containers

---

## Current Task
**Phase 1.9 Draft Management + Gap Report — COMPLETE**

Draft duplicate and gap/suggestion report shipped to both blue and green containers.

### Recent completions (April 22, 2026)
- ✅ **Draft duplicate** — `POST /api/generate/drafts/{id}/duplicate` backend endpoint
- ✅ **Gap report endpoint** — `GET /api/generate/drafts/{id}/gaps` scans `[DATA NEEDED: ...]` placeholders
- ✅ **DraftsPage UI** — Copy icon button added to draft row (duplicates immediately, inserts at top)
- ✅ **DraftViewPage UI** — "Gaps" button in header opens amber collapsible panel with numbered gap list
- ✅ **Both containers deployed** — tip-blue (CT190) and tip-green (CT191) on latest main

### Next steps
1. **BYOK Claude API key** — user profile field for personal Claude API key
2. **Excel parser tuning** — validate against real discovery workbooks

---

## Known Issues
- ℹ️ **2 Playwright tests skipped** — documents and drafts specs have skipped tests (not failures); acceptable for now.

---

## Exact Next Command
```
# Test gap report on a real draft
curl -si https://blue-tip.cloudigan.net/api/generate/drafts/{id}/gaps
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
