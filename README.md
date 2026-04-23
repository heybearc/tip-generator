# TIP Generator

An AI-powered Technical Implementation Plan (TIP) generator that uses the Anthropic Claude API to produce professional, structured TIP documents from your existing discovery worksheets and service orders.

---

## What it does

Upload your project inputs, and the app generates a complete, formatted TIP document ready for review and export:

- **Discovery Worksheets** (Excel) — project scope, environment details, dependencies
- **Service Orders** (PDF) — customer requirements and deliverables
- **Word Templates** — your branded TIP template drives the output structure and styling
- **TIP Library** — a curated set of reference TIPs used as few-shot examples to improve generation quality

The generated draft is editable in-browser, then exported as a fully-formatted `.docx` (with optional PDF).

---

## Feature Overview

| Feature | Status |
|---|---|
| Document upload (Excel, PDF, DOCX) | ✅ |
| Word template management (admin) | ✅ |
| Claude-powered TIP generation | ✅ |
| Chunked generation for large documents | ✅ |
| Draft management & inline editing | ✅ |
| Word + PDF export | ✅ |
| TIP Library with few-shot injection | ✅ |
| Library document title & category editing (admin) | ✅ |
| Document type reclassification | ✅ |
| AI-suggested document categories | ✅ |
| Shared documents (available to all users) | ✅ |
| Role-based access control (admin / user) | ✅ |
| OAuth2 / OIDC authentication | ✅ |
| Background task queue (Celery + Redis) | ✅ |
| Blue-green zero-downtime deployment | ✅ |

---

## Architecture

```
┌─────────────────────────────────────┐
│           Browser (React)           │
│         Vite + Tailwind CSS         │
└──────────────┬──────────────────────┘
               │ HTTP / REST
┌──────────────▼──────────────────────┐
│         FastAPI Backend             │
│  Routers: auth, upload, generate,   │
│  library, template, admin           │
│                                     │
│  Services:                          │
│   • ClaudeService  (Anthropic SDK)  │
│   • UploadService  (docx/pdf/xlsx)  │
└──────┬───────────────┬──────────────┘
       │               │
┌──────▼──────┐  ┌─────▼──────────────┐
│ PostgreSQL  │  │  Celery Worker      │
│  (SQLAlchemy│  │  (Redis broker)     │
│   ORM)      │  │  TIP generation     │
└─────────────┘  └────────────────────┘
```

**Stack at a glance:**

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, lucide-react |
| Backend | FastAPI 0.109, Python 3.11+, Uvicorn |
| ORM | SQLAlchemy 2.0 |
| Database | PostgreSQL 14+ |
| AI | Anthropic Claude (`claude-sonnet-4-5` default) |
| Task Queue | Celery 5 + Redis |
| Auth | OAuth2/OIDC (Authentik or any OIDC provider) |
| Doc Processing | python-docx, openpyxl, PyMuPDF |
| Export | python-docx (Word), PyMuPDF (PDF) |

---

## Self-Hosting Guide

### Prerequisites

- Python 3.11+
- Node.js 20 LTS
- PostgreSQL 14+ database
- Redis instance (for Celery task queue)
- Anthropic API key — [get one here](https://console.anthropic.com/)
- An OIDC-compatible auth provider (Authentik, Auth0, Keycloak, etc.) — or you can adapt `backend/routers/auth.py` for simple username/password

### 1. Clone the repository

```bash
git clone https://github.com/heybearc/tip-generator.git
cd tip-generator
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` — the required variables are:

```env
DATABASE_URL=postgresql://user:password@localhost/tip_generator
ANTHROPIC_API_KEY=sk-ant-...
SECRET_KEY=<random 32-byte hex — generate with: openssl rand -hex 32>
REDIS_URL=redis://localhost:6379/0

# OIDC provider (Authentik shown — adapt to your provider)
AUTHENTIK_DOMAIN=auth.example.com
AUTHENTIK_CLIENT_ID=your_client_id
AUTHENTIK_CLIENT_SECRET=your_client_secret
OAUTH_REDIRECT_URI=https://your-domain.com/auth/callback

CORS_ORIGINS=https://your-domain.com
```

Optional tuning:

```env
CLAUDE_MODEL=claude-sonnet-4-5      # or any Anthropic model
CLAUDE_MAX_TOKENS=16000
MAX_UPLOAD_SIZE_MB=50
LOG_LEVEL=INFO
```

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Database tables are auto-created on first run
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Celery Worker (required for TIP generation)

In a separate terminal:

```bash
cd backend
source venv/bin/activate
celery -A celery_app worker --loglevel=info
```

> Generation runs as a background task — without the worker, the Generate page will queue but never complete.

### 5. Frontend

```bash
cd frontend
npm install
npm run dev        # development server on :5173
# or
npm run build      # production build → dist/
```

For production, serve `frontend/dist/` via Nginx or point Vite's `VITE_API_URL` to your backend.

### 6. Upload a Word template

Log in as an admin user, go to **Admin → Template**, and upload your `.docx` TIP template. The app will parse its heading styles, colors, and structure to use during generation.

---

## Project Structure

```
tip-generator/
├── backend/
│   ├── main.py               # FastAPI app, startup, CORS
│   ├── celery_app.py         # Celery task: TIP generation worker
│   ├── requirements.txt
│   ├── database/             # SQLAlchemy engine + session
│   ├── models/               # ORM models (User, Draft, Document, LibraryDocument, …)
│   ├── routers/              # API route handlers
│   │   ├── auth.py           # OAuth2/OIDC login + session
│   │   ├── upload.py         # Document upload + management
│   │   ├── generate.py       # Draft CRUD + generation trigger + export
│   │   ├── library.py        # TIP Library (admin upload, approval, category)
│   │   ├── template.py       # Word template management
│   │   ├── admin.py          # Admin dashboard endpoints
│   │   └── release_notes.py  # Release notes feed
│   ├── schemas/              # Pydantic request/response schemas
│   └── services/
│       ├── claude.py         # Claude API integration + prompt construction
│       └── upload.py         # File storage + text extraction
├── frontend/
│   ├── src/
│   │   ├── pages/            # React page components
│   │   ├── components/       # Shared UI components
│   │   └── App.tsx           # Router + layout
│   ├── package.json
│   └── vite.config.ts
├── tests/                    # Backend test suite
└── .env.example              # Root-level env reference
```

---

## Authentication

The app uses OAuth2/OIDC. `backend/routers/auth.py` is configured for **Authentik** by default but the flow is standard — swap in Auth0, Keycloak, or any OIDC provider by updating the discovery URL and env vars.

On first startup, a default admin user (id=1) is created automatically. Documents uploaded by user id=1 are treated as **shared documents** — visible and usable by all users when generating TIPs.

---

## TIP Library

The Library is a curated set of approved reference TIPs. When generating a new TIP, up to 3 approved library documents (filtered by category match) are injected as few-shot examples into the Claude prompt to improve output quality.

Admins upload documents, optionally set a category (or let Claude suggest one), then approve or reject them. Only approved documents are injected into generation.

---

## Do I need to package this?

No packaging required — this is a standard web application. Your collaborator just needs to:

1. Clone the repo
2. Set up the environment (`.env`)
3. Run the backend (`uvicorn`) + worker (`celery`) + frontend (`npm run build` → serve static files)

There's no pip package or npm package to publish. If they want a one-command startup, a `docker-compose.yml` would be the cleanest option — open an issue if that's needed.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make changes and test
4. Open a pull request against `main`

Backend changes: run `cd backend && pytest tests/` before submitting.

---

## License

MIT License — see `LICENSE` file for details.
