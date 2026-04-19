# TIP Generator

AI-powered Technical Implementation Plan (TIP) generator using Claude API for intelligent document processing and content generation.

## Overview

TIP Generator automates the creation of Technical Implementation Plans by:
- Uploading Excel discovery worksheets and PDF service orders
- Parsing Word document templates to understand structure and styling
- Using Claude API to generate contextually appropriate content
- Preserving original template formatting and branding
- Exporting completed TIPs in Word and PDF formats

## Architecture

**Tech Stack:**
- **Backend:** FastAPI (Python 3.11+)
- **Frontend:** React with Vite
- **Database:** PostgreSQL (shared cluster)
- **Authentication:** Authentik OAuth2/OIDC
- **AI:** Claude API (Anthropic)
- **Document Processing:** python-docx, openpyxl, PyMuPDF

**Deployment:**
- **Blue-Green Containers:** CT190 (10.92.3.90), CT191 (10.92.3.91)
- **HAProxy VIP:** 10.92.3.33
- **Domain:** https://tip.cloudigan.net
- **Database:** tip_generator on PostgreSQL (10.92.3.21:5432)
- **Port:** 8000 (FastAPI)

## Features (Phase 1 - v1)

- ✅ Single-user operation with remote access
- ✅ Server-side Word template management
- ✅ Intelligent template parsing (structure, styles, colors)
- ✅ Excel and PDF document upload
- ✅ AI-powered content generation with Claude
- ✅ Draft management and persistence
- ✅ Word and PDF export with style preservation
- ✅ Authentik OAuth authentication

## Development

### Prerequisites

- Python 3.11+
- Node.js 20.x LTS
- PostgreSQL access (10.92.3.21)
- Authentik OAuth credentials
- Claude API key

### Local Setup

```bash
# Clone repository
git clone git@github.com:heybearc/tip-generator.git
cd tip-generator

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run development servers
# Backend: uvicorn main:app --reload --port 8000
# Frontend: npm run dev
```

### Environment Variables

See `.env.example` for required configuration.

## Deployment

**Production Deployment:**
- Blue-green deployment via HAProxy
- Containers: CT190 (BLUE), CT191 (GREEN)
- Database: Shared PostgreSQL HA cluster
- Backups: Tier 1 (daily at 2 AM, 7/4/3 retention)

**Deployment Process:**
1. Deploy to STANDBY container
2. Test functionality
3. Switch HAProxy traffic
4. Sync old LIVE container

## Documentation

- **Architecture Plan:** `~/.windsurf/plans/tip-generator-webapp-424e2d.md`
- **Deployment Guide:** `homelab-nexus/documentation/TIP-GENERATOR-DEPLOYMENT.md`
- **Decisions:** D-036 (phased rollout), D-037 (template management)

## License

Private - Cloudigan Internal Use Only

## Contact

For questions or support, contact the development team.
