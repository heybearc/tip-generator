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

### Third-Party API (leaves infrastructure)

| Data | Destination | Purpose |
|------|-------------|---------|
| Extracted document text | Anthropic Claude API (`api.anthropic.com`) | TIP generation |
| Section text (on refine) | Anthropic Claude API | Section-level AI editing |

---

## Anthropic API Data Policy

TIP Generator uses the **Anthropic Claude API** (not Claude.ai consumer product).
These are different products with different data policies.

**Anthropic API commitments:**
- ✅ **No training** — Anthropic does not train models on API traffic by default
- ✅ **Do-not-store header** — All requests from TIP Generator include `X-Anthropic-Do-Not-Store: true`, instructing Anthropic to skip even temporary retention
- ✅ **Encrypted in transit** — All API calls use TLS 1.2+
- ✅ **BYOK** — Each user supplies their own Anthropic API key; Thrive does not hold a shared key

Reference: [Anthropic Privacy Policy](https://www.anthropic.com/privacy) | [API Terms](https://www.anthropic.com/legal/commercial-terms)

---

## What This Means for Customer Data

- Customer infrastructure data (IPs, hostnames, network layouts) is sent to Anthropic's API to generate the TIP
- Anthropic does not retain or train on this data per their commercial API terms
- The `X-Anthropic-Do-Not-Store: true` header provides an additional explicit signal
- Generated TIPs are stored only in Thrive's own PostgreSQL instance

---

## Recommendations Before Customer-Facing Rollout

- [ ] Inform customers that document content is processed by Anthropic's Claude API
- [ ] Reference this document in any MSA or data processing addendum
- [ ] Consider a DPA (Data Processing Agreement) with Anthropic for enterprise customers — available on Anthropic's Enterprise tier
- [ ] Review Anthropic's [sub-processor list](https://www.anthropic.com/legal/sub-processors) for any compliance requirements

---

## BM25 / RAG (Library Chunks)

The section-chunk playbook (RAG) uses **BM25 keyword matching** running entirely in-process on the TIP Generator container. No data is sent to any external service for retrieval. Library chunks are stored in Thrive's own PostgreSQL instance.

---

*Last reviewed: 2026-04-23*
