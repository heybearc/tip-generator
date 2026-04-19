# Windsurf Boot - TIP Generator

You are working on **TIP Generator** (AI-powered Technical Implementation Plan generator using Claude API for intelligent document processing and content generation).

---

## Load Context (in order)

### Shared Context (from Cloudy-Work control plane)
Load these from the Cloudy-Work repo (or submodule if configured):

- `CONTROL-PLANE.md`
- `_cloudy-ops/context/CURRENT-STATE.md`
- `_cloudy-ops/context/APP-MAP.md`
- `_cloudy-ops/context/DECISIONS.md` (shared architectural decisions)
- `_cloudy-ops/context/RUNBOOK-SHORT.md`

### TIP Generator Local Context
- `TASK-STATE.md` (what I'm working on right now)
- `DECISIONS.md` (repo-local decisions)

---

## App-Specific Information

**Canonical path:** /opt/tip-generator  
**Port:** 8000 (FastAPI backend)  
**STANDBY target:** CT190 (10.92.3.90) or CT191 (10.92.3.91)  
**LIVE target:** CT190 (10.92.3.90) or CT191 (10.92.3.91)  
**HAProxy VIP:** 10.92.3.33  
**Domain:** https://tip.cloudigan.net

**Tech stack:**
- Backend: FastAPI (Python 3.11+)
- Frontend: React with Vite
- Database: PostgreSQL (10.92.3.21:5432, database: tip_generator)
- Auth: Authentik OAuth2/OIDC
- AI: Claude API (Anthropic)
- Document Processing: python-docx, openpyxl, PyMuPDF

**Key directories:**
- backend/ - FastAPI application
- frontend/ - React frontend with Vite
- docs/ - Documentation

---

## Rules (same as all repos)
- No secrets in git. `.env` stays container-local (chmod 600).
- Port standard is 8000 for this FastAPI app.
- Use STANDBY/LIVE language; SSH aliases are implementation details.
- Canonical paths are fixed.

---

## When You Make Progress
1. Update `TASK-STATE.md` (current work)
2. Append to `DECISIONS.md` if making repo-local decisions
3. Commit when appropriate

---

## Quick Commands

### Check app status
```bash
ssh ct190-tip 'systemctl status tip-generator'
```

### View app logs
```bash
ssh ct190-tip 'journalctl -u tip-generator -f'
```

### Test API endpoint
```bash
curl https://tip.cloudigan.net/api/health
```
