import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import UploadPage from './pages/UploadPage'
import DraftsPage from './pages/DraftsPage'
import DraftViewPage from './pages/DraftViewPage'
import TemplateManagementPage from './pages/TemplateManagementPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/drafts" element={<DraftsPage />} />
        <Route path="/drafts/:id" element={<DraftViewPage />} />
        <Route path="/admin/template" element={<TemplateManagementPage />} />
      </Routes>
    </Layout>
  )
}

export default App
