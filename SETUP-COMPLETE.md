# TIP Generator - Setup Complete! 🎉

**Date:** April 20, 2026  
**Status:** Backend production-ready, Frontend structure complete

---

## 🚀 What's Live

### Production URLs
- **Main:** https://tip.cloudigan.net
- **Blue (Dev):** https://blue-tip.cloudigan.net
- **Green (Standby):** https://green-tip.cloudigan.net
- **API Docs:** https://blue-tip.cloudigan.net/docs

### Infrastructure
- ✅ Blue-green containers (CT190, CT191)
- ✅ HAProxy load balancing
- ✅ NPM SSL termination
- ✅ PostgreSQL database (4 tables)
- ✅ Systemd service management

---

## 📦 Backend (Production Ready)

### Technology Stack
- **Framework:** FastAPI 0.109.2
- **Database:** PostgreSQL + SQLAlchemy 2.0.27
- **AI Model:** Claude Sonnet 4.6 (latest)
- **Document Processing:** openpyxl, PyMuPDF, python-docx

### API Endpoints

**Health Check:**
```bash
GET /api/health
```

**Document Upload:**
```bash
POST /api/upload/discovery        # Excel files
POST /api/upload/service-order    # PDF files
GET  /api/upload/documents         # List all
GET  /api/upload/documents/{id}    # Get one
```

**TIP Generation:**
```bash
POST /api/generate/draft           # Create draft
POST /api/generate/tip             # Generate TIP
GET  /api/generate/drafts          # List drafts
GET  /api/generate/drafts/{id}     # Get draft
```

### Database Models
- **users** - Authentication and profiles
- **documents** - Uploaded files with text extraction
- **drafts** - TIP work in progress
- **templates** - TIP templates (ready for future use)

### Features
- ✅ File upload (Excel, PDF, Word)
- ✅ Text extraction from documents
- ✅ Claude Sonnet 4.6 integration
- ✅ TIP generation from uploaded docs
- ✅ Draft management
- ✅ Structured output parsing

---

## 🎨 Frontend (Structure Complete)

### Technology Stack
- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **Icons:** Lucide React

### Pages Created
- ✅ Home page (feature overview)
- ✅ Upload page (stub)
- ✅ Drafts page (stub)
- ✅ Draft view page (stub)

### Components
- ✅ Layout with header/footer
- ✅ Navigation menu
- ✅ Responsive design

### Next Steps for Frontend
```bash
cd frontend
npm install
npm run dev
```

Then build out:
1. Upload component with drag & drop
2. Draft creation form
3. TIP generation UI
4. Generated TIP display
5. Export functionality

---

## 🔑 Environment Variables

Located in `backend/.env` on CT190:

```bash
# Database
DATABASE_URL=postgresql://tip_user:***@10.92.3.21:5432/tip_generator

# Claude API
ANTHROPIC_API_KEY=sk-ant-***
CLAUDE_MODEL=claude-sonnet-4-6
CLAUDE_MAX_TOKENS=4096

# Security
SECRET_KEY=***
JWT_SECRET_KEY=***
```

---

## 📊 Current Deployment

**Active:** CT190 (Blue)
- Backend running on port 8000
- Service: `tip-generator.service`
- Status: Active and healthy

**Standby:** CT191 (Green)
- Backend running on port 8000
- Ready for blue-green deployment
- Not yet synced with latest code

---

## 🎯 Workflow

### Typical TIP Generation Flow

1. **Upload Documents**
   ```bash
   curl -X POST https://blue-tip.cloudigan.net/api/upload/discovery \
     -F "file=@discovery.xlsx"
   
   curl -X POST https://blue-tip.cloudigan.net/api/upload/service-order \
     -F "file=@service-order.pdf"
   ```

2. **Create Draft**
   ```bash
   curl -X POST https://blue-tip.cloudigan.net/api/generate/draft \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Project XYZ TIP",
       "discovery_document_id": 1,
       "service_order_document_id": 2
     }'
   ```

3. **Generate TIP**
   ```bash
   curl -X POST https://blue-tip.cloudigan.net/api/generate/tip \
     -H "Content-Type: application/json" \
     -d '{"draft_id": 1}'
   ```

4. **View Result**
   ```bash
   curl https://blue-tip.cloudigan.net/api/generate/drafts/1
   ```

---

## 🔄 Blue-Green Deployment

**Current Strategy:**
- Develop on CT190 (blue)
- Deploy to CT191 (green) when stable
- Switch traffic via HAProxy

**To Deploy to Green:**
```bash
ssh ct191-tip
cd /opt/tip-generator
git pull origin main
systemctl restart tip-generator
```

---

## 📝 Key Decisions

**D-LOCAL-003:** Claude Sonnet 4.6
- Latest model (2026) with improved intelligence
- Better structured output for TIPs
- Same pricing as 3.5 Sonnet

**D-LOCAL-004:** Blue-only development
- Faster iteration on CT190
- Deploy to CT191 only when stable

---

## 🚧 Pending Features

### High Priority
- [ ] Frontend component development
- [ ] Document upload UI with drag & drop
- [ ] TIP generation interface
- [ ] Generated TIP display

### Medium Priority
- [ ] Authentik OAuth integration
- [ ] Word/PDF export functionality
- [ ] Template management UI
- [ ] User management

### Low Priority
- [ ] Email notifications
- [ ] Webhooks for async generation
- [ ] Version history
- [ ] Collaboration features

---

## 📚 Documentation

- **API Docs:** https://blue-tip.cloudigan.net/docs
- **TASK-STATE.md:** Current progress tracking
- **DECISIONS.md:** Technical decisions log
- **PLAN.md:** Project roadmap

---

## 🎓 Testing the Backend

**Via API Docs:**
Visit https://blue-tip.cloudigan.net/docs and use the interactive Swagger UI

**Via curl:**
```bash
# Health check
curl https://blue-tip.cloudigan.net/api/health

# Upload a file
curl -X POST https://blue-tip.cloudigan.net/api/upload/discovery \
  -F "file=@test.xlsx"

# List documents
curl https://blue-tip.cloudigan.net/api/upload/documents
```

---

## 🎉 Success Metrics

- ✅ Backend deployed and operational
- ✅ All API endpoints functional
- ✅ Claude Sonnet 4.6 integrated
- ✅ Database tables created
- ✅ Document processing working
- ✅ Blue-green infrastructure ready
- ✅ Frontend structure complete

**The TIP Generator backend is production-ready!** 🚀

Next: Build out the frontend UI for a complete user experience.
