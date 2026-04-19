# TIP Generator - Development Guide

**Last Updated:** 2026-04-19  
**Phase:** Phase 1 (v1 - Single User)

---

## Project Overview

TIP Generator automates the creation of Technical Implementation Plans by:
1. Parsing Word document templates to understand structure and styling
2. Processing Excel discovery worksheets and PDF service orders
3. Using Claude API to generate contextually appropriate content
4. Preserving original template formatting and branding
5. Exporting completed TIPs in Word and PDF formats

---

## Tech Stack

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL with SQLAlchemy ORM
- **Authentication:** OAuth2/OIDC with Authentik
- **AI:** Claude API (Anthropic)
- **Document Processing:**
  - `python-docx` - Word document parsing and generation
  - `openpyxl` - Excel file processing
  - `PyMuPDF` (fitz) - PDF parsing
  - `reportlab` or `weasyprint` - PDF generation

### Frontend
- **Framework:** React 18.x
- **Build Tool:** Vite
- **Styling:** TailwindCSS
- **State Management:** React Context / Zustand
- **HTTP Client:** Axios
- **File Upload:** react-dropzone

### Infrastructure
- **Deployment:** Blue-green (CT190/CT191)
- **Load Balancer:** HAProxy
- **Reverse Proxy:** Nginx Proxy Manager
- **Process Manager:** PM2
- **Monitoring:** Prometheus, Grafana, Loki

---

## Development Environment Setup

### Prerequisites

- Python 3.11+
- Node.js 20.x LTS
- PostgreSQL client tools
- Git with SSH keys configured
- Access to homelab infrastructure

### Local Setup

**1. Clone Repository:**
```bash
git clone git@github.com:heybearc/tip-generator.git
cd tip-generator
git submodule update --init --recursive
```

**2. Backend Setup:**
```bash
cd backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp ../.env.example .env
# Edit .env with your credentials

# Run database migrations (once implemented)
# alembic upgrade head

# Start development server
uvicorn main:app --reload --port 8000
```

**3. Frontend Setup:**
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

**4. Access Application:**
- Backend API: http://localhost:8000
- Frontend: http://localhost:5173 (Vite default)
- API Docs: http://localhost:8000/docs (FastAPI Swagger)

---

## Project Structure

```
tip-generator/
├── .cloudy-work/          # Master Control governance
├── backend/
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── auth.py    # OAuth endpoints
│   │   │   ├── projects.py
│   │   │   ├── templates.py
│   │   │   ├── documents.py
│   │   │   └── generation.py
│   │   ├── core/          # Core functionality
│   │   │   ├── config.py  # Settings
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   ├── models/        # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   ├── template.py
│   │   │   └── document.py
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   │   ├── template_parser.py
│   │   │   ├── document_processor.py
│   │   │   ├── ai_generator.py
│   │   │   └── export_service.py
│   │   └── utils/         # Utilities
│   ├── tests/
│   ├── alembic/           # Database migrations
│   ├── main.py            # FastAPI app entry
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── auth/
│   │   │   ├── projects/
│   │   │   ├── templates/
│   │   │   ├── documents/
│   │   │   └── generation/
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API clients
│   │   ├── utils/         # Utilities
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── ARCHITECTURE.md    # Full architecture plan
│   ├── DEPLOYMENT.md      # Deployment guide
│   └── DEVELOPMENT.md     # This file
├── .env.example
├── .gitignore
└── README.md
```

---

## Phase 1 Features (v1 - Single User)

### Core Features

**1. Template Management**
- Upload Word template (admin only)
- Auto-parse template structure
- Detect sections, styles, and colors
- Store template metadata in database
- Single active template at a time

**2. Document Upload**
- Upload Excel discovery worksheet
- Upload PDF service order/SOW
- Validate file formats
- Store files temporarily for processing

**3. AI-Powered Generation**
- Parse Excel data into structured format
- Extract text from PDF SOW
- Send to Claude API with template context
- Generate content for each TIP section
- Preserve template styling

**4. Draft Management**
- Save project drafts to database
- List user's projects
- Edit and regenerate sections
- Version history (optional)

**5. Document Export**
- Export as Word (.docx) with original styling
- Export as PDF with formatting preserved
- Download generated documents

**6. Authentication**
- OAuth2/OIDC with Authentik
- Single-user access (Phase 1)
- Session management

### API Endpoints

**Authentication:**
- `GET /auth/login` - Initiate OAuth flow
- `GET /auth/callback` - OAuth callback
- `GET /auth/logout` - Logout
- `GET /auth/me` - Get current user

**Templates:**
- `POST /api/templates/upload` - Upload template (admin)
- `GET /api/templates/active` - Get active template
- `GET /api/templates/{id}/structure` - Get parsed structure

**Projects:**
- `POST /api/projects` - Create new project
- `GET /api/projects` - List user's projects
- `GET /api/projects/{id}` - Get project details
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

**Documents:**
- `POST /api/projects/{id}/upload/excel` - Upload Excel
- `POST /api/projects/{id}/upload/pdf` - Upload PDF
- `GET /api/projects/{id}/documents` - List documents

**Generation:**
- `POST /api/projects/{id}/generate` - Generate TIP
- `GET /api/projects/{id}/status` - Generation status
- `POST /api/projects/{id}/regenerate/{section}` - Regenerate section

**Export:**
- `GET /api/projects/{id}/export/word` - Export as Word
- `GET /api/projects/{id}/export/pdf` - Export as PDF

**Health:**
- `GET /health` - Health check endpoint

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    authentik_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Templates Table
```sql
CREATE TABLE templates (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    file_path VARCHAR(500) NOT NULL,
    structure JSONB,  -- Parsed template structure
    is_active BOOLEAN DEFAULT FALSE,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Projects Table
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES templates(id),
    status VARCHAR(50),  -- draft, generating, completed
    generated_content JSONB,  -- AI-generated content by section
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Documents Table
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    type VARCHAR(50),  -- excel, pdf
    file_path VARCHAR(500) NOT NULL,
    parsed_data JSONB,  -- Extracted data
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Claude API Integration

### Prompt Strategy

**Template Context:**
```
You are assisting in generating a Technical Implementation Plan (TIP).

Template Structure:
- Section 1: Executive Summary
- Section 2: Project Scope
- Section 3: Technical Requirements
[... full template structure ...]

Style Guidelines:
- Heading 1: Arial 16pt Bold, Color: #003366
- Body Text: Arial 11pt, Color: #000000
[... full style guide ...]
```

**Generation Request:**
```
Based on the following discovery data and service order, generate content for [Section Name]:

Discovery Data (from Excel):
- Customer: [name]
- Location: [address]
- Requirements: [list]

Service Order (from PDF):
- Products: [list]
- Services: [list]
- Timeline: [dates]

Generate professional, technical content that fits the template style.
```

### API Configuration

```python
import anthropic

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=4096,
    messages=[
        {"role": "user", "content": prompt}
    ]
)
```

---

## Testing Strategy

### Backend Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_template_parser.py
```

### Frontend Tests

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Integration Tests

Test full workflow:
1. Upload template
2. Create project
3. Upload documents
4. Generate TIP
5. Export documents

---

## Development Workflow

### Feature Development

1. **Create Branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Develop & Test:**
   - Write code
   - Add tests
   - Test locally

3. **Commit:**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

4. **Push & Deploy:**
   ```bash
   git push origin feature/your-feature-name
   # Merge to main via PR or direct
   git checkout main
   git merge feature/your-feature-name
   git push origin main
   ```

5. **Deploy to STANDBY:**
   ```
   mcp0_deploy_to_standby tip-generator
   ```

6. **Test & Switch:**
   - Test on STANDBY
   - Switch traffic when ready

### Debugging

**Backend:**
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
uvicorn main:app --reload --log-level debug
```

**Frontend:**
```bash
# React DevTools
# Vue DevTools (if using Vue)
# Browser console
```

**Database:**
```bash
# Connect to database
psql postgresql://tip_user:TipGen2026!Secure@10.92.3.21:5432/tip_generator

# View tables
\dt

# Query data
SELECT * FROM projects;
```

---

## Code Style & Standards

### Python (Backend)

- **Formatter:** Black
- **Linter:** Flake8 / Ruff
- **Type Hints:** Required
- **Docstrings:** Google style

```python
def parse_template(file_path: str) -> TemplateStructure:
    """Parse Word template and extract structure.
    
    Args:
        file_path: Path to Word document
        
    Returns:
        Parsed template structure
        
    Raises:
        TemplateParseError: If parsing fails
    """
    pass
```

### JavaScript (Frontend)

- **Formatter:** Prettier
- **Linter:** ESLint
- **Style:** Functional components, hooks
- **Naming:** camelCase for variables, PascalCase for components

```javascript
// Good
const ProjectList = ({ projects }) => {
  const [selectedProject, setSelectedProject] = useState(null);
  
  return (
    <div className="project-list">
      {projects.map(project => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
};
```

---

## Security Considerations

1. **Never commit secrets** - Use .env files
2. **Validate all inputs** - Sanitize file uploads
3. **Use HTTPS** - All production traffic
4. **OAuth tokens** - Secure session management
5. **File permissions** - Restrict upload directories
6. **SQL injection** - Use SQLAlchemy ORM
7. **XSS protection** - Sanitize user content

---

## Performance Optimization

1. **Database queries** - Use indexes, avoid N+1
2. **File uploads** - Stream large files
3. **AI generation** - Cache responses when possible
4. **Frontend** - Code splitting, lazy loading
5. **API responses** - Pagination for lists

---

## Related Documentation

- **Architecture:** `docs/ARCHITECTURE.md`
- **Deployment:** `docs/DEPLOYMENT.md`
- **Infrastructure:** `homelab-nexus/documentation/TIP-GENERATOR-DEPLOYMENT.md`

---

**Happy coding! 🚀**
