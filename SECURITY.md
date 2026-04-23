# Security & Data Privacy

## Data Flow

TIP Generator processes customer documents to generate Technical Implementation Plans.
This document describes exactly where customer data goes and what protections are in place.

### On-Premise (stays in Thrive infrastructure)

| Data | Location |
|------|----------|
| Uploaded files (Excel, PDF, Word) | NFS mount `/mnt/tip-uploads` on shared storage |
| Extracted document text | PostgreSQL `documents.extracted_text` (10.92.3.21) |
| Generated TIP drafts | PostgreSQL `drafts.content` |
| User accounts & API keys | PostgreSQL `users` table |
| Library / playbook chunks | PostgreSQL `library_chunks` table |
| PII token maps (when scrubbing enabled) | PostgreSQL `draft_pii_maps` table |

### Third-Party API (leaves infrastructure)

| Data | Destination | Purpose | Header |
|------|-------------|---------|--------|
| Extracted document text (or scrubbed version) | Anthropic Claude API (`api.anthropic.com`) | TIP generation | `X-Anthropic-Do-Not-Store: true` |
| Section text (on refine / refine-all) | Anthropic Claude API | Section-level AI editing | `X-Anthropic-Do-Not-Store: true` |
| Document text preview (on library upload) | Anthropic Claude API | Auto-category suggestion | `X-Anthropic-Do-Not-Store: true` |

---

## Anthropic API Data Policy

TIP Generator uses the **Anthropic Claude API** (not Claude.ai consumer product).
These are different products with different data policies.

**Anthropic API commitments:**
- ✅ **No training** — Anthropic does not train models on API traffic by default (commercial API terms)
- ✅ **Do-not-store header** — All requests from TIP Generator include `X-Anthropic-Do-Not-Store: true` on every API client (generation, refine, refine-all, library auto-categorisation), instructing Anthropic to skip even temporary retention
- ✅ **Encrypted in transit** — All API calls use TLS 1.2+
- ✅ **BYOK** — Each user supplies their own Anthropic API key; Thrive does not hold a shared key

Reference: [Anthropic Privacy Policy](https://www.anthropic.com/privacy) | [API Terms](https://www.anthropic.com/legal/commercial-terms)

---

## PII Scrubbing (Optional, Per-Generation)

TIP Generator includes an optional **PII pseudonymisation** layer powered by Microsoft Presidio + spaCy.

**How it works:**
1. Before sending document text to Claude, detected PII entities (names, IPs, email addresses, phone numbers, org names, locations) are replaced with `{{ENTITY_TYPE_N}}` tokens
2. The token→original mapping is stored in `draft_pii_maps` (Thrive's PostgreSQL, never leaves infrastructure)
3. After Claude returns the generated TIP, tokens are substituted back with original values
4. The final stored draft contains real customer data; pseudonymised text exists only in-transit to Claude

**Current default:** `scrub_pii = False` (opt-in per generation)

**Limitations:**
- Presidio NLP detection is probabilistic — some PII may not be detected (especially domain-specific technical identifiers)
- Token substitution can reduce output quality if Claude cannot infer context from placeholder tokens
- Quality must be verified before enabling by default — see TASK-STATE.md

**Recommended path to always-on:**
1. Run paired test generations (scrub off vs. scrub on) with a real customer worksheet
2. Review output quality — confirm IPs/hostnames in generated tables are correct after restore
3. If quality is acceptable, flip `scrub_pii` default to `True` in `backend/schemas/draft.py`

---

## Library Chunks & Promoted Sections

- Library chunks (including sections promoted from drafts) are stored in `library_chunks` on Thrive's PostgreSQL
- The Library page displays only chunk **titles and tags** — never chunk content — to prevent customer data exposure in the UI
- Chunk content is injected into Claude prompts at generation time and is subject to the same `X-Anthropic-Do-Not-Store: true` header as all other API calls
- BM25 retrieval runs entirely in-process on the TIP Generator container — no external retrieval service

---

## What This Means for Customer Data

- Customer infrastructure data (IPs, hostnames, network layouts) is sent to Anthropic's API to generate the TIP — either as-is or pseudonymised if PII scrubbing is enabled
- Anthropic does not retain or train on this data per their commercial API terms
- The `X-Anthropic-Do-Not-Store: true` header is applied to all API calls as an explicit additional signal
- Generated TIPs are stored only in Thrive's own PostgreSQL instance

---

## Recommendations Before Customer-Facing Rollout

- [ ] Inform customers that document content is processed by Anthropic's Claude API (include in MSA or engagement letter)
- [ ] Reference this document in any data processing addendum
- [ ] Verify PII scrubbing quality and consider enabling by default
- [ ] Consider a DPA (Data Processing Agreement) with Anthropic for enterprise customers — available on Anthropic's Enterprise tier
- [ ] Review Anthropic's [sub-processor list](https://www.anthropic.com/legal/sub-processors) for any compliance requirements

---

*Last reviewed: 2026-04-23 — do_not_store header confirmed on all API clients; PII scrubbing available opt-in*
