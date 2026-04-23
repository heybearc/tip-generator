# TIP Generator Task State

**Last updated:** 2026-04-23 (v0.9.0 released — PII pseudonymization, RAG chunks, data privacy)
**Current branch:** main
**Working on:** Idle — v0.9.0 live

---

## Current Task
**Phase 2.5 — RAG / Section-Chunk Playbook** — COMPLETE ✅  
**Security: Customer Data Privacy** — COMPLETE ✅ (`do_not_store` header, PII pseudonymization, `SECURITY.md`)
**v0.9.0** — LIVE ✅

### Confirmed Complete
- ✅ **Phase 2.1** — Admin dashboard
- ✅ **Phase 2.2** — TIP Library (few-shot injection, RAG-ready schema)
- ✅ **Phase 2.3** — Draft Collaboration (collaborators table, invite/remove, typeahead search, shared badge)
- ✅ **v0.6.0** — LIVE=GREEN (CT191, 10.92.3.92) | STANDBY=BLUE (CT190, 10.92.3.91)
- ✅ **Phase 2.4** — Multi-document context injection validated; 40-page output with 4 docs confirmed correct
- ✅ **Few-shot scoring** — replaced blind "2 most recent" with keyword overlap scoring (draft title + discovery filename vs library title + category); scores logged at generation time
- ✅ **Excel parser tuning** — dropdown validation extraction added (`[Options: ...]` hint in output); table row-advance bug fixed; KV threshold relaxed to 4 cells
- ✅ **Phase 2.5 RAG** — pgvector + `library_chunks` table; BM25 retrieval (no external API); 193 chunks indexed from 11 approved library docs; chunks injected at generation time per section; MCP deploy fixed to use venv pip
- ✅ **v0.9.0 RELEASED** — LIVE=BLUE (CT190, 10.92.3.91) | STANDBY=GREEN (CT191, 10.92.3.92) | 56/56 tests passing

### Next steps
1. **Verify PII quality on real TIP** — ⏳ PENDING (next generation) — scrub toggle enabled; confirm output is correct after restore
2. **Admin UI: promote section → chunk** — allow admin to manually promote a draft section to library chunk (Phase 2.5 backlog)
3. **PII scrub → always-on** — after quality verified, flip default to `True` in `DraftCreate` schema

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
