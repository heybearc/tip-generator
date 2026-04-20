# TIP Generator Repo-Local Decisions

This file tracks decisions specific to working on TIP Generator.

For shared architectural decisions that apply to all apps, see the Cloudy-Work control plane:
`.cloudy-work/_cloudy-ops/context/DECISIONS.md`

---

## Decision Template

When adding a decision, use this format:

## D-LOCAL-XXX: [Short decision title]
- **Decision:** [What was decided]
- **Why:** [Rationale - why this choice over alternatives]
- **When:** [Date and context]
- **Alternatives considered:** [Optional - what else was considered]

---

## D-LOCAL-001: FastAPI backend with React frontend
- **Decision:** Use FastAPI (Python 3.11+) for backend API and React with Vite for frontend
- **Why:** FastAPI provides excellent performance for document processing APIs, native async support, and automatic OpenAPI documentation. React with Vite offers fast development experience and modern build tooling.
- **When:** 2026-04-19 (initial architecture)
- **Alternatives considered:** Django REST Framework (too heavy), Flask (lacks async), Next.js full-stack (Python better for document processing)

## D-LOCAL-002: Port 8000 for FastAPI backend
- **Decision:** TIP Generator uses port 8000 for FastAPI backend, not the standard 3001 used by Next.js apps
- **Why:** FastAPI convention is port 8000. Deviating from global port standard (3001) is acceptable for non-Next.js apps.
- **When:** 2026-04-19
- **Note:** This is an exception to D-001 (port standardization) which applies to Next.js apps only

## D-LOCAL-003: Claude Sonnet 4.6 for TIP generation
- **Decision:** Use Claude Sonnet 4.6 (latest) instead of Claude 3.5 Sonnet for AI-powered TIP generation
- **Why:** Sonnet 4.6 is the newest model (2026) with improved intelligence, better structured output, and superior technical writing capabilities. Same pricing tier as 3.5 Sonnet but significantly better quality.
- **When:** 2026-04-20 (mid-day update)
- **Alternatives considered:** Opus 4.7 (too expensive for standard use), Haiku 4.5 (too fast/cheap, lower quality), 3.5 Sonnet (outdated)

## D-LOCAL-004: Blue-only development, green as standby
- **Decision:** Develop and test exclusively on CT190 (blue), keep CT191 (green) as standby for blue-green deployment
- **Why:** Faster iteration during development. Deploy to green only when features are stable and ready for production traffic switching.
- **When:** 2026-04-20
- **Consequences:** Must manually sync code to green when ready for deployment
