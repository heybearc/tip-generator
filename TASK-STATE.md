# TIP Generator Task State

**Last updated:** 2026-04-23 (v0.10.0 released — section management, full pillars, PII fix, Celery isolation)
**Current branch:** main
**Working on:** Idle — v0.10.0 live

---

## Current Task
**v0.10.0** — LIVE ✅ (GREEN, CT191, 10.92.3.92)

### Confirmed Complete
- ✅ **Phase 2.1–2.5** — all complete (see PLAN.md)
- ✅ **v0.9.0** — released 2026-04-23
- ✅ **Section order & visibility** — drag-and-drop manager; export respects visibility
- ✅ **Multi-pass pillar generation** — all 6 pillars guaranteed; 2x3-pillar passes
- ✅ **PII scrubbing fix** — `SimpleNamespace` prevents SQLAlchemy session flush crash
- ✅ **Celery queue isolation** — `CELERY_QUEUE` env var; celery-blue / celery-green per environment
- ✅ **Cancel generation fix** — revokes Celery task, clears `generation_prompt`
- ✅ **Dynamic batch count** — stale pre-write removed; UI shows correct chunk total
- ✅ **Refine-all fix** — skips structural sections, 8 workers, 5min nginx+frontend timeout
- ✅ **E2E test suite** — 19/19 passing on STANDBY before release
- ✅ **v0.10.0 RELEASED** — LIVE=GREEN (CT191, 10.92.3.92) | STANDBY=BLUE (CT190, 10.92.3.91) | synced

### Next steps
1. **PII quality verification** — run a real generation with scrub enabled; confirm restored output is correct
2. **PII scrub → always-on** — after quality verified, flip default to `True` in `DraftCreate` schema
3. **Admin UI: promote section → chunk** — Phase 2.5 backlog item

---

## ⚠️ Security: Customer Data Privacy

**Issue:** Customer data (discovery worksheets, service orders, supplemental docs) is extracted as plain text and sent to the Anthropic Claude API at TIP generation time. This means customer infrastructure data leaves Thrive's infrastructure.

**Current data flow:**
1. Customer uploads doc → NFS mount (`/mnt/tip-uploads`) ✅ stays on-prem
2. Extracted text → PostgreSQL `documents.extracted_text` ✅ stays on-prem
3. At generation → extracted text sent to `api.anthropic.com` ⚠️ **leaves infrastructure**
4. Claude returns TIP → stored in PostgreSQL ✅ stays on-prem

**Anthropic's actual policy:**
- API traffic is **not used for training** by default (Anthropic's commercial API terms)
- Data is retained for up to **30 days** for trust & safety review, then deleted
- Zero-retention option available via **Anthropic's Business/Enterprise tier** (`"do_not_store": true` request header)
- Claude.ai (consumer product) ≠ Claude API — consumer product may train; API does not

**Options to investigate (in order of effort):**
1. **Verify current API tier** — check if the per-user BYOK keys are on standard or business tier; standard tier already no-training
2. **Add `do_not_store` header** — if on eligible tier, add `X-Anthropic-Do-Not-Store: true` to all API calls (1-line change)
3. **PII scrubbing before send** — strip customer names, IPs, domains before sending to Claude (complex, risky — may degrade output quality)
4. **On-premise LLM** — self-hosted model (Ollama + Llama/Mistral) — eliminates third-party exposure entirely but degrades output quality significantly
5. **Document and accept** — formally document the data flow, get customer consent at onboarding (lightest-weight)

**Recommended immediate action:**
- [ ] Verify Anthropic API tier and confirm no-training policy applies to BYOK keys
- [ ] Add `do_not_store` header to all Claude API calls (zero-effort if eligible)
- [ ] Add data flow disclosure to user onboarding / admin docs
- [ ] Add a `SECURITY.md` to the repo documenting the data flow for audit trail

---

## Known Issues
- ℹ️ **2 Playwright tests skipped** — data-dependent (require existing drafts); acceptable for now.
- ℹ️ **Tests run against STANDBY** — pass `BASE_URL=https://green-tip.cloudigan.net` (or blue) when running on qa-01; global-setup reuses auth-state.json if <25 min old.
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
- Current LIVE: GREEN (CT191, 10.92.3.92) — switched 2026-04-23 after v0.10.0 release (switch #1)
- Domains: https://tip.cloudigan.net → GREEN (LIVE) | https://green-tip.cloudigan.net (LIVE) | https://blue-tip.cloudigan.net (STANDBY)
