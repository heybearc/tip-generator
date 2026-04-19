# TIP Generator Task State

**Last updated:** 2026-04-19  
**Current branch:** main  
**Working on:** Repository initialization with Master Control governance

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
- ⏳ Ready to commit all changes

### Recent completions
- ✅ Master Control submodule initialized
- ✅ Workflow system available (20+ workflows)
- ✅ BOOT.md customized for TIP Generator
- ✅ PLAN.md created with standardized structure
- ✅ SSH config updated with TIP Generator entries
- ✅ APP-MAP.md updated with TIP Generator details

### Next steps
1. Commit Master Control updates (SSH config, APP-MAP)
2. Commit local repo initialization files
3. Set up Python virtual environment on both containers
4. Install backend dependencies (FastAPI, python-docx, openpyxl, PyMuPDF, etc.)
5. Install frontend dependencies (React, Vite)
6. Configure systemd services for FastAPI backend
7. Set up Authentik OAuth configuration
8. Configure HAProxy backend for TIP Generator
9. Set up NPM proxy for https://tip.cloudigan.net

---

## Known Issues
None - fresh repository initialization

---

## Exact Next Command
```bash
# Commit Master Control updates
cd .cloudy-work
git add ssh_config_master.conf _cloudy-ops/context/APP-MAP.md
git commit -m "feat: add TIP Generator infrastructure (CT190/CT191)"
git push origin main

# Commit local repo initialization
cd ..
git add .windsurf BOOT.md DECISIONS.md TASK-STATE.md PLAN.md
git commit -m "chore: initialize Master Control governance and workflows"
git push origin main
```

---

## Notes
- TIP Generator uses FastAPI (port 8000), not Next.js (port 3001)
- Blue-green containers: CT190 (10.92.3.90), CT191 (10.92.3.91)
- Database: tip_generator on PostgreSQL (10.92.3.21:5432)
- Domain: https://tip.cloudigan.net
