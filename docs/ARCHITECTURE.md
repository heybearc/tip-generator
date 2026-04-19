# TIP Generator Web Application (Phased Approach)

A self-hosted web application that uses AI to automatically generate Technical Implementation Plans (TIPs) from Excel discovery data and PDF service orders, using a reusable Word template with intelligent structure and style preservation.

## Phased Rollout Strategy

**Version 1.0 (Single User):**
- Personal use with remote access capability
- Authentik or M365 OAuth authentication
- Single reusable Word template (server-side file)
- Draft saving and project management
- Focus on core generation quality

**Version 2.0 (Team Expansion):**
- Multi-user project sharing
- Collaborative editing features
- Multiple template support
- Role-based permissions
- Blue-green deployment setup

## Architecture Overview

**Stack:**
- **Frontend:** React + TailwindCSS + shadcn/ui (modern, responsive UI)
- **Backend:** FastAPI (Python) - handles file processing, AI orchestration, document generation
- **AI:** Claude API (Anthropic) with fallback flexibility
- **Storage:** PostgreSQL for metadata/drafts + filesystem for documents
- **Authentication:** Authentik OAuth (v1) with M365 OAuth option, expandable to team auth (v2)
- **Deployment:** Docker container in Proxmox LXC, behind NPM reverse proxy, blue-green ready

## Core Features

### 1. Template Management & Document Upload

**Template Handling (v1):**
- **Server-Side Template:** Single Word template stored at `/data/tip-generator/templates/active-template.docx`
- **Template Analysis on Startup:**
  - Parse template structure using `python-docx`
  - Extract section headings (Heading 1, Heading 2, etc.)
  - Capture paragraph styles, fonts, colors, and formatting
  - Build section map: `{section_name: {style_info, placeholder_markers}}`
  - Cache template structure for fast generation
- **Template Updates:** Replace file on server when new version released (v2: admin UI)

**Document Upload (Per Project):**
- **Upload Interface:** Drag-and-drop for 2 document types:
  - Excel (.xlsx) discovery/customer data worksheet
  - PDF service order/SOW
- **File Parsing:**
  - `openpyxl` for Excel data parsing (standardized worksheet format)
  - `PyMuPDF` or `pdfplumber` for PDF text extraction
- **Validation:** Check file types, sizes, and basic structure before processing

### 2. AI-Powered Content Generation with Template Awareness

**Template Structure Auto-Detection:**
- Parse template on startup to identify all sections (Heading 1/2 levels)
- Detect placeholder text or empty sections that need content
- Extract existing formatting rules (fonts, colors, spacing)
- Build section taxonomy: e.g., "Executive Summary", "Scope", "Timeline", "Deliverables"

**Intelligent Content Generation:**
- **Prompt Engineering:**
  - System prompt: "You are a technical writer generating TIP content"
  - Context includes: 
    - Template section names and structure
    - Excel data fields (customer info, requirements, products)
    - SOW content (scope, deliverables, pricing)
  - Claude maps data to appropriate template sections automatically
  
- **Section-by-Section Generation:**
  - Iterate through template sections in order
  - For each section, AI determines:
    - Which Excel fields are relevant
    - Which SOW paragraphs apply
    - Appropriate tone and detail level
  - Generate content that fits section purpose
  
- **Style Preservation:**
  - Apply original template formatting to generated content
  - Maintain heading styles, font colors, bullet formats
  - Preserve company branding elements

### 3. Interactive Review & Editing
- **Split-Pane Editor:**
  - Left: Section-by-section view of generated TIP
  - Right: AI chat interface for revisions
- **Revision Workflow:**
  - Users can request changes: "Make the timeline more aggressive" or "Add more detail to risk assessment"
  - AI regenerates specific sections while maintaining context
  - Track revision history per section
- **Manual Editing:** Rich text editor for direct modifications

### 4. Draft Management & Project Persistence

**Project Workspace (v1 - Single User):**
- Each TIP generation is a "project" with unique ID
- Save drafts at any stage (uploaded docs + generated content + revisions)
- Resume work later from any device (remote access via Authentik)
- Project metadata: name, created date, last modified, status (draft/final)

**Version Control:**
- Auto-save drafts every 2 minutes
- Manual save checkpoints
- Rollback to previous versions
- Track revision history with timestamps

**Future Team Features (v2):**
- Shared project access across team members
- Real-time collaboration indicators
- Comment threads on sections
- Approval workflows

### 5. Document Export with Style Preservation

**Output Formats:**
- **Word (.docx):** Fully formatted, preserves original template styling
  - Maintains all fonts, colors, heading styles
  - Preserves company branding, logos, headers/footers
  - Uses template as base document, populates with generated content
- **PDF:** Professional layout converted from Word output
  - Identical styling to Word version
  - Print-ready format for client delivery

**Generation Process:**
- **Word Creation:**
  - Clone original template document
  - Replace placeholder sections with AI-generated content
  - Apply cached style information to new paragraphs
  - Preserve all formatting: fonts, colors, spacing, bullets
  - Maintain document properties (metadata, page setup)
- **PDF Conversion:**
  - Convert Word output to PDF using `python-docx` + `docx2pdf` or LibreOffice headless
  - Ensure high-fidelity rendering

**Download & Archive:**
- Immediate download after generation
- Store final versions in project history
- Filename format: `TIP_{project_name}_{date}.docx/pdf`

## Technical Implementation Details

### Backend API Endpoints
```
# Template Management
GET    /api/template/info   - Get current template structure/metadata
POST   /api/template/upload - Upload new template (v2 feature)

# Project Operations
POST   /api/projects        - Create new project
GET    /api/projects        - List all projects (user's projects)
GET    /api/projects/{id}   - Get project details
PUT    /api/projects/{id}   - Update/save draft
DELETE /api/projects/{id}   - Delete project

# Document Processing
POST   /api/projects/{id}/upload    - Upload Excel + PDF for project
POST   /api/projects/{id}/generate  - Trigger AI generation
POST   /api/projects/{id}/revise    - Request AI revision for section

# Export
POST   /api/projects/{id}/export    - Generate Word/PDF output
GET    /api/projects/{id}/download  - Download generated files
```

### Database Schema
```
templates:
  - id (UUID)
  - filename (string)
  - version (string)
  - uploaded_at (timestamp)
  - structure (JSON: parsed sections, styles, formatting)
  - is_active (boolean)

projects:
  - id (UUID)
  - name (string)
  - created_by (user_id from Authentik)
  - created_at, updated_at (timestamps)
  - status (draft/in_progress/final)
  - template_id (FK to templates)
  - source_files (JSON: {excel_path, pdf_path})
  - generated_content (JSON: {section_name: content})
  - revision_history (JSON: [{timestamp, section, change, user_prompt}])
  - export_files (JSON: {word_path, pdf_path})
```

### File Storage Structure
```
/data/tip-generator/
  ├── templates/
  │   ├── active-template.docx       # Current template in use
  │   └── archive/
  │       └── template-v{version}.docx  # Historical versions
  ├── projects/
  │   └── {project_id}/
  │       ├── uploads/
  │       │   ├── discovery.xlsx
  │       │   └── sow.pdf
  │       ├── drafts/
  │       │   └── draft-{timestamp}.json  # Auto-saved versions
  │       └── exports/
  │           ├── {project_name}.docx
  │           └── {project_name}.pdf
  └── cache/
      └── template-structure.json    # Parsed template metadata
```

### AI Integration Strategy

**API Client:** `anthropic` Python SDK

**Template-Aware Prompt Structure:**
```
System: "You are an expert technical writer specializing in Technical Implementation Plans."

Context:
- Template Structure: {parsed_sections_with_descriptions}
- Customer Data: {excel_fields_extracted}
- Service Order: {sow_content_parsed}

Task: "Generate content for the '{section_name}' section of the TIP.
This section typically covers: {section_purpose_from_template}
Use the following data: {relevant_data_for_section}
Maintain a professional, technical tone. Format as {detected_format: paragraph/bullets/table}."
```

**Intelligent Section Mapping:**
- AI analyzes template section names/context to determine purpose
- Auto-maps Excel fields to appropriate sections (e.g., customer name → header, products → scope)
- Extracts relevant SOW paragraphs for each section
- Adapts content length to match template section size

**Token Management:**
- Chunk large SOW documents if >100k tokens
- Use Claude 3.5 Sonnet for balance of quality/cost
- Cache template structure to reduce repeated tokens

**Error Handling:**
- Retry logic with exponential backoff
- Fallback to partial generation if section fails
- User notifications with actionable error messages

### Authentication Flow (v1)

**Primary Option: Authentik OAuth/OIDC**
- OAuth2/OIDC flow via existing Authentik instance
- Backend validates JWT tokens
- Extract user info (name, email) for project metadata

**Alternative Option: M365 OAuth**
- Microsoft Azure AD OAuth integration
- Use work/school account for authentication
- Leverage existing Microsoft identity

**Session Management:**
- JWT stored in httpOnly cookies
- 24-hour session expiry with refresh token
- Secure session storage in Redis (optional)

**v2 Team Expansion:**
- Multi-user support with role-based access
- Project ownership and sharing permissions
- Activity audit logs

## Deployment Plan

### Container Setup (v1 - Single Instance)
1. **LXC Container:** Create in Proxmox (function: dev, 2 cores, 4GB RAM, 50GB storage)
2. **Docker Compose:**
   ```yaml
   services:
     frontend:
       - React app (Vite build)
       - Nginx serving static files
       - Port 3000
     backend:
       - FastAPI application
       - Gunicorn with Uvicorn workers
       - Port 8000
     postgres:
       - Database for projects/drafts/templates
       - Port 5432 (internal)
   ```
3. **Volumes:**
   - `/data/tip-generator` - Document storage (persistent)
   - `postgres-data` - Database data
   - `logs` - Application logs

### Blue-Green Deployment (v2)
- **Architecture:** Two identical containers (LIVE/STANDBY)
- **HAProxy:** Traffic switching between instances
- **Shared Storage:** NFS mount for `/data/tip-generator`
- **Database:** Shared PostgreSQL or replicated instances
- **Zero-Downtime Updates:** Deploy to STANDBY, test, switch traffic

### NPM Configuration
- **Domain:** `tip-generator.cloudigan.net` (or preferred subdomain)
- **SSL:** Let's Encrypt certificate
- **Proxy:** Forward to container IP:port
- **Authentik:** Protect with forward auth

### Environment Variables
```
# AI Configuration
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/tipgenerator

# Authentication (Choose one)
AUTH_PROVIDER=authentik  # or 'microsoft'

# Authentik OAuth
AUTHENTIK_CLIENT_ID=...
AUTHENTIK_CLIENT_SECRET=...
AUTHENTIK_DOMAIN=auth.cloudigan.net
AUTHENTIK_REDIRECT_URI=https://tip-generator.cloudigan.net/auth/callback

# Microsoft OAuth (Alternative)
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=...

# Application
STORAGE_PATH=/data/tip-generator
TEMPLATE_PATH=/data/tip-generator/templates/active-template.docx
SESSION_SECRET=...
ALLOWED_ORIGINS=https://tip-generator.cloudigan.net
```

## Development Phases (v1 - Single User)

### Phase 1: Core Infrastructure & Template Parsing (Week 1)
- Set up project structure (React + FastAPI)
- **Template Parser Development:**
  - Parse Word template structure (headings, sections)
  - Extract styles (fonts, colors, formatting)
  - Build section taxonomy and cache
- Database schema and models (PostgreSQL)
- File upload and storage system
- Authentik OAuth integration
- Basic UI shell (login, dashboard)

### Phase 2: Document Processing & AI Engine (Week 2)
- Excel parser (openpyxl) - extract customer data
- PDF parser (PyMuPDF) - extract SOW content
- **Claude API Integration:**
  - Template-aware prompt engineering
  - Section-by-section generation logic
  - Intelligent data mapping (Excel/SOW → template sections)
- Error handling and retry mechanisms
- Background job processing (Celery/Redis optional)

### Phase 3: UI & Interactive Editing (Week 2-3)
- Project creation and upload interface
- **Split-Pane Editor:**
  - Section-by-section view with navigation
  - AI chat interface for revisions
  - Real-time preview of generated content
- Draft auto-save (every 2 minutes)
- Version history and rollback
- Loading states and progress indicators

### Phase 4: Export with Style Preservation (Week 3)
- **Word Document Generation:**
  - Clone template as base
  - Populate sections with AI content
  - Apply original styles to new content
  - Preserve formatting, colors, branding
- **PDF Conversion:**
  - High-fidelity Word → PDF conversion
  - Maintain all styling and layout
- Download and archive functionality
- UI polish and error messaging

### Phase 5: Deployment & Testing (Week 4)
- Docker Compose configuration
- Deploy to Proxmox LXC container
- NPM reverse proxy + SSL setup
- End-to-end testing with real documents
- Performance optimization
- User documentation
- Backup and monitoring setup

### Future Phase 6: Team Expansion (v2)
- Multi-user project sharing
- Blue-green deployment setup
- Template management UI
- Collaborative editing features
- Role-based access control

## Future Enhancements (v2+)

**Team Collaboration:**
- Multi-user project sharing and permissions
- Real-time co-editing with presence indicators
- Comment threads on specific sections
- Approval workflows for final TIPs

**Template Management:**
- Multiple template support (network, security, cloud projects)
- Template versioning and history
- Admin UI for template upload/management
- Template preview and testing

**Advanced Features:**
- Custom Excel worksheet templates per project type
- AI learning from user edits (improve future generations)
- Analytics dashboard (generation times, common revisions)
- API access for programmatic TIP generation
- Integration with CRM/ticketing systems
- Batch processing for multiple projects

**Blue-Green Deployment:**
- Zero-downtime updates
- HAProxy traffic switching
- Automated health checks
- Rollback capabilities

## Technical Considerations

### Security
- File upload size limits (50MB per file)
- Virus scanning for uploaded documents
- Input sanitization for AI prompts
- Rate limiting on API endpoints
- Secure credential storage (environment variables)

### Performance
- Async processing for AI generation (avoid blocking)
- Background jobs for document export
- Caching for template structures
- Database indexing on project queries
- CDN for frontend assets (optional)

### Monitoring
- Application logs (structured JSON)
- AI API usage tracking (costs)
- Error alerting (failed generations)
- Performance metrics (response times)

## Success Metrics

**v1 (Single User):**
- **Generation Quality:** 80%+ of TIPs require minimal manual editing after AI generation
- **Time Savings:** Reduce TIP creation from 4-6 hours to 30-45 minutes
- **Template Accuracy:** 95%+ style preservation (fonts, colors, formatting)
- **Reliability:** <5% generation failures, graceful error handling
- **User Satisfaction:** Positive feedback on ease of use and output quality

**v2 (Team):**
- **Team Adoption:** All team members actively using within 2 weeks
- **Collaboration:** 50%+ of projects involve multiple contributors
- **Uptime:** 99%+ availability with blue-green deployment

---

## Next Steps

1. **Review & Approve Plan:** Confirm architecture and feature set
2. **Gather Sample Documents:** Provide example TIP template, Excel worksheet, SOW
3. **Set Up Development Environment:** Create project structure and dependencies
4. **Begin Phase 1:** Start with backend infrastructure and file processing
