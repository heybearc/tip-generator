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

## D-LOCAL-001: Shared NFS storage for uploaded documents

- **Decision:** Use TrueNAS NFS share (`10.92.0.3:/mnt/media-pool/tip-uploads`) mounted at `/mnt/tip-uploads` on both CT190 and CT191 for storing uploaded documents
- **Why:** 
  - Blue-green deployment requires both containers to access the same files
  - Container-local storage (`/var/tmp`) doesn't persist across container rebuilds
  - NFS provides shared, persistent storage without manual file syncing
  - TrueNAS already provides enterprise-grade storage with RAIDZ1 redundancy
- **When:** 2026-04-20
- **Implementation:**
  - TrueNAS dataset: `media-pool/tip-uploads` with LZ4 compression
  - NFS share ID 19, allows 10.92.0.0/16 network, mapall to root:root
  - Proxmox host mounts NFS at `/mnt/pve/tip-uploads` (in `/etc/fstab`)
  - Both containers get bind mount via `pct set <vmid> -mp0 /mnt/pve/tip-uploads,mp=/mnt/tip-uploads`
  - Backend service uses `/mnt/tip-uploads` as upload directory
- **Alternatives considered:**
  1. **PostgreSQL BYTEA storage** - Rejected: Poor performance for large files, bloats database
  2. **Rsync between containers** - Rejected: Requires manual sync during deployments, race conditions
  3. **S3-compatible object storage** - Rejected: Overkill for this use case, adds complexity
  4. **Container-local storage** - Rejected: Files don't persist across blue-green switches
- **Database:** File metadata (filename, path, extracted text) stored in PostgreSQL, actual files on NFS
- **Monitoring:** TrueNAS pool health monitored via custom exporter on CT150:9200

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

## D-LOCAL-005: deploy.sh script on each container
- **Decision:** Each container has `/opt/tip-generator/deploy.sh` as the canonical deploy method
- **Why:** Previous ad-hoc `git pull && cd frontend && npm run build` commands failed because shell context was lost between commands, causing stale builds. A single script in the repo root runs all steps in correct order.
- **When:** 2026-04-20
- **Usage:** `ssh tip-blue '/opt/tip-generator/deploy.sh'` or `ssh tip-green '/opt/tip-generator/deploy.sh'`
- **Steps:** git pull → npm run build (frontend) → restart tip-generator → reload nginx → health check

## D-LOCAL-006: SSH config covers bare IPs for both TIP containers
- **Decision:** SSH config `Host` entries for CT190 and CT191 include the raw IP address as an alias, with `StrictHostKeyChecking accept-new` and `CheckHostIP no`
- **Why:** Containers occasionally have host key changes after Proxmox maintenance. Without this, every SSH command breaks requiring manual `ssh-keygen -R`. `CheckHostIP no` prevents ECDSA/ED25519 confusion when the same IP changes keys.
- **When:** 2026-04-20
- **Aliases:** `tip-blue`, `ct190-tip`, `10.92.3.91` → CT190 / `tip-green`, `ct191-tip`, `10.92.3.92` → CT191
