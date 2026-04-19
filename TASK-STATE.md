# TIP Generator Task State

**Last updated:** 2026-04-19 (7:40 PM)  
**Current branch:** main  
**Working on:** Backend deployment and infrastructure setup

---

## Current Task
Initializing TIP Generator repository with Master Control (Cloudy-Work) governance files and workflows.

### What I'm doing right now
- ✅ Initialized `.cloudy-work` submodule
- ✅ Created `.windsurf` symlink to control plane workflows
- ✅ Created governance files (BOOT.md, TASK-STATE.md, DECISIONS.md, PLAN.md)
- ✅ Customized BOOT.md with TIP Generator specifics
- ✅ Added SSH config entries for CT190/CT191 to Master Control
- ✅ Updated APP-MAP.md with TIP Generator infrastructure details
- ✅ Copied SSH config to ~/.ssh/config
- ✅ Configured SSH keys on CT190 and CT191 via Proxmox
- ✅ Installed git, Python 3.10, pip, venv on both containers
- ✅ Cloned repo to both containers at /opt/tip-generator
- ✅ Committed all Master Control and local repo changes
- ✅ Created FastAPI backend skeleton with requirements.txt
- ✅ Set up Python virtual environments on both containers
- ✅ Installed all backend dependencies (FastAPI, python-docx, openpyxl, PyMuPDF, anthropic, etc.)
- ✅ Created and started systemd services on both containers
- ✅ Verified health endpoints working on both CT190 and CT191
- ⏳ Ready for HAProxy and NPM configuration

### Recent completions
- ✅ Master Control submodule initialized
- ✅ Workflow system available (20+ workflows)
- ✅ BOOT.md customized for TIP Generator
- ✅ PLAN.md created with standardized structure
- ✅ SSH config updated with TIP Generator entries
- ✅ APP-MAP.md updated with TIP Generator details

### Next steps
1. Configure HAProxy backend for TIP Generator (add to HAProxy config)
2. Set up NPM proxy for https://tip.cloudigan.net
3. Create database and user on PostgreSQL (tip_generator database)
4. Set up Authentik OAuth application
5. Create .env files on both containers with credentials
6. Install frontend dependencies (React, Vite, Node.js)
7. Build and configure frontend
8. Test end-to-end connectivity through HAProxy VIP
9. Verify blue-green switching works

---

## Known Issues
None - fresh repository initialization

---

## Exact Next Command
```bash
# Verify both backends are running
curl http://10.92.3.90:8000/health  # CT190 (blue)
curl http://10.92.3.91:8000/health  # CT191 (green)

# Next: Configure HAProxy backend
ssh haproxy 'cat /etc/haproxy/haproxy.cfg | grep -A 10 "backend.*tip"'
```

---

## Notes
- TIP Generator uses FastAPI (port 8000), not Next.js (port 3001)
- Blue-green containers: CT190 (10.92.3.90), CT191 (10.92.3.91)
- Database: tip_generator on PostgreSQL (10.92.3.21:5432)
- Domain: https://tip.cloudigan.net
