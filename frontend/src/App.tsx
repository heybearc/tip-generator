import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import UploadPage from './pages/UploadPage'
import DraftsPage from './pages/DraftsPage'
import DraftViewPage from './pages/DraftViewPage'
import TemplateManagementPage from './pages/TemplateManagementPage'
import DocumentsPage from './pages/DocumentsPage'
import GeneratePage from './pages/GeneratePage'
import HelpPage from './pages/HelpPage'
import ReleaseNotesPage from './pages/ReleaseNotesPage'
import GettingStartedPage from './pages/help/GettingStartedPage'
import UploadDocumentsPage from './pages/help/UploadDocumentsPage'
import GenerateTipPage from './pages/help/GenerateTipPage'
import ManageDraftsPage from './pages/help/ManageDraftsPage'
import TemplateManagementHelpPage from './pages/help/TemplateManagementPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/drafts" element={<DraftsPage />} />
        <Route path="/drafts/:id" element={<DraftViewPage />} />
        <Route path="/admin/template" element={<TemplateManagementPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/help/getting-started" element={<GettingStartedPage />} />
        <Route path="/help/upload-documents" element={<UploadDocumentsPage />} />
        <Route path="/help/generate-tip" element={<GenerateTipPage />} />
        <Route path="/help/manage-drafts" element={<ManageDraftsPage />} />
        <Route path="/help/template-management" element={<TemplateManagementHelpPage />} />
        <Route path="/release-notes" element={<ReleaseNotesPage />} />
      </Routes>
    </Layout>
  )
}

export default App
