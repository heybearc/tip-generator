# TIP Generator Plan

**Last updated:** 2026-04-20 7:37 AM  
**Current phase:** Phase 1 - MVP Implementation (Template Parsing)  
**Status:** Blue-green deployment operational, template management complete, starting template parsing

**Development Discipline:**
- 🔵 **Blue-Green Development**: Work on ONE container at a time (CT190 blue = dev, CT191 green = stable)
- 🛡️ **Database Protection**: NEVER reset/erase DB, use backwards-compatible migrations only
- 🔄 **Deployment Flow**: Dev on blue → Test → Deploy to green → Switch traffic

---

## Current Phase: Template Parsing & TIP Generation Engine

### Active Work (IN PROGRESS)
**Phase 1.3: Template Parsing** - Parse Word templates to extract structure
- ⏳ Add python-docx to backend dependencies
- ⏳ Create template parser service
- ⏳ Extract sections, headings, placeholders from .docx
- ⏳ Store template structure in database (new fields, backwards compatible)
- ⏳ API endpoint to get template structure

### Completed This Phase
**Phase 1.1: Infrastructure & Deployment** ✅
- ✅ Master Control (Cloudy-Work) submodule initialized
- ✅ Workflow system integrated (20+ workflows available)
- ✅ Governance files created (BOOT.md, TASK-STATE.md, DECISIONS.md, PLAN.md)
- ✅ Blue-green containers deployed (CT190 @ 10.92.3.91, CT191 @ 10.92.3.92)
- ✅ HAProxy + NPM + SSL configured
- ✅ Shared PostgreSQL database (10.92.3.21)
- ✅ Shared NFS storage for uploads (/mnt/tip-uploads)
- ✅ Backend FastAPI deployed as systemd service
- ✅ Frontend React + Vite production build with nginx
- ✅ All domains operational (tip.cloudigan.net, blue-tip, green-tip)

**Phase 1.2: Document & Template Management** ✅
- ✅ Document upload API (Excel, PDF, Word) with auto-type detection
- ✅ Upload page with drag & drop
- ✅ Document management page with filtering and delete
- ✅ Template management system (/admin/template)
- ✅ Template file storage with versioning
- ✅ Template upload/download/activate endpoints
- ✅ NFS shared storage for templates and uploads
- ✅ Fixed nginx proxy configuration for API routing

---

## Upcoming Phases

### Phase 1.3: Template Parsing (CURRENT)
**Objective:** Extract structure from Word templates for TIP generation

**Tasks:**
- ⏳ Add python-docx library to requirements.txt
- ⏳ Create TemplateParser service class
- ⏳ Parse .docx to extract:
  - Sections and headings hierarchy
  - Placeholders ({{variable_name}} format)
  - Instructions for Claude (special markers)
  - Formatting/styling metadata
- ⏳ Add template_structure JSON field to template_files table (backwards compatible)
- ⏳ API endpoint: GET /api/templates/{id}/structure
- ⏳ Store parsed structure when template uploaded

**Development:** Blue container (CT190) only, test before deploying to green

### Phase 1.4: Template Display (Options A & B)
**Objective:** Show template info and preview to users

**Option A - Active Template Info:**
- Display current template name/version during TIP generation
- Show template metadata (sections, last updated, etc.)
- Add to generation page UI

**Option B - Template Preview/Structure Viewer:**
- Visual representation of template sections
- Show placeholders and what they map to
- Collapsible section tree view
- Add to /admin/template page

**Development:** Blue container (CT190) only

### Phase 1.5: TIP Generation Engine
**Objective:** Generate TIPs using templates and uploaded documents

**Tasks:**
- Map uploaded documents to template sections
- Extract relevant data from discovery worksheets
- Extract requirements from service orders
- Use Claude API to generate content for each section
- Follow template instructions for tone/style
- Inject findings into placeholders
- Preserve template formatting
- Create draft with generated content

**Development:** Blue container (CT190) only, extensive testing required

### Phase 1.6: TIP Preview & Export
**Objective:** Preview and export generated TIPs

**Tasks:**
- Preview TIP in template format (web view)
- Export as Word document (.docx) with formatting
- Export as PDF
- Download functionality

**Development:** Blue container (CT190) only

---

## Prioritized Backlog

### High Priority (After Phase 1.6)
- **Authentication**
  - Authentik OAuth2/OIDC integration
  - User session management
  - Protected routes

- **Testing & Refinement**
  - End-to-end workflow testing
  - Claude prompt optimization
  - Template parsing edge cases
  - Export formatting validation

### Medium Priority
- **Database Schema**
  - User management tables
  - Template metadata storage
  - Draft persistence
  - Audit logging

- **Document Processing**
  - Excel parsing (openpyxl)
  - PDF parsing (PyMuPDF)
  - Word template analysis (python-docx)
  - Style preservation during generation

### Low Priority
- **Testing**
  - API endpoint tests
  - Document processing tests
  - Integration tests with Claude API
  - E2E tests for complete workflow

- **Documentation**
  - API documentation (FastAPI auto-generated)
  - User guide
  - Deployment guide
  - Development setup guide

---

## Known Issues
None - fresh repository initialization

---

## Roadmap

### Phase 1: MVP Implementation (Current)
**Objective:** Single-user TIP generation with remote access

**Deliverables:**
- ✅ Repository setup and governance
- ⏳ Backend API (FastAPI)
- ⏳ Frontend UI (React + Vite)
- ⏳ Authentik OAuth authentication
- ⏳ Document upload and processing
- ⏳ Claude API integration
- ⏳ Word/PDF export with style preservation
- ⏳ Blue-green deployment to CT190/CT191

**Success Criteria:**
- User can upload Excel discovery worksheet and PDF service order
- System generates TIP using Claude API
- Generated TIP preserves template formatting
- User can export as Word and PDF
- Deployed to production with blue-green architecture

### Phase 2: Multi-User Support (Future)
**Objective:** Support multiple users with role-based access

**Deliverables:**
- User management system
- Role-based permissions
- Template library management
- Draft sharing and collaboration
- Audit logging

### Phase 3: Advanced Features (Future)
**Objective:** Enhanced automation and intelligence

**Deliverables:**
- Template version control
- AI-powered template suggestions
- Batch processing
- Advanced export options
- Analytics and reporting

---

## Deferred Items
None yet - fresh project

---

## Recently Completed
- ✅ Repository created and initialized
- ✅ Master Control governance integrated
- ✅ Development environment configured
