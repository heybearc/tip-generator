import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_superuser) return <Navigate to="/" replace />
  return <>{children}</>
}
import HomePage from './pages/HomePage'
import UploadPage from './pages/UploadPage'
import DraftsPage from './pages/DraftsPage'
import DraftViewPage from './pages/DraftViewPage'
import TemplateManagementPage from './pages/TemplateManagementPage'
import DocumentsPage from './pages/DocumentsPage'
import GeneratePage from './pages/GeneratePage'
import HelpPage from './pages/HelpPage'
import ReleaseNotesPage from './pages/ReleaseNotesPage'
import ProfilePage from './pages/ProfilePage'
import GettingStartedPage from './pages/help/GettingStartedPage'
import UploadDocumentsPage from './pages/help/UploadDocumentsPage'
import GenerateTipPage from './pages/help/GenerateTipPage'
import ManageDraftsPage from './pages/help/ManageDraftsPage'
import TemplateManagementHelpPage from './pages/help/TemplateManagementPage'
import AdminUsersPage from './pages/AdminUsersPage'

function App() {
  return (
    <AuthProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <ProtectedRoute>
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
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
    </AuthProvider>
  )
}

export default App
