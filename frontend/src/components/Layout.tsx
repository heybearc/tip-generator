import { Link, useLocation } from 'react-router-dom'
import { FileText, Upload, FolderOpen, Settings, Files, Wand2, HelpCircle, BookOpen, LogOut, User, KeyRound, ShieldCheck, Library } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { user, logout } = useAuth()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <h1 className="ml-3 text-2xl font-bold text-gray-900">
                TIP Generator
              </h1>
            </div>
            <nav className="flex space-x-4">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Home
              </Link>
              <Link
                to="/upload"
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  isActive('/upload')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Link>
              <Link
                to="/generate"
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  isActive('/generate')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Wand2 className="h-4 w-4 mr-1" />
                Generate
              </Link>
              <Link
                to="/documents"
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  isActive('/documents')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Files className="h-4 w-4 mr-1" />
                Documents
              </Link>
              <Link
                to="/drafts"
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  isActive('/drafts')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                Drafts
              </Link>
              <Link
                to="/admin/template"
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  isActive('/admin/template')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings className="h-4 w-4 mr-1" />
                Template
              </Link>
              <Link
                to="/library"
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  isActive('/library')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Library className="h-4 w-4 mr-1" />
                Library
              </Link>
              <Link
                to="/release-notes"
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  isActive('/release-notes')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <BookOpen className="h-4 w-4 mr-1" />
                What's New
              </Link>
              {user?.is_superuser && (
                <Link
                  to="/admin/users"
                  className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                    location.pathname.startsWith('/admin/users')
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  Admin
                </Link>
              )}
              <Link
                to="/help"
                className={`px-3 py-2 rounded-md text-sm font-medium flex items-center ${
                  location.pathname.startsWith('/help')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <HelpCircle className="h-4 w-4 mr-1" />
                Help
              </Link>
            </nav>
            {/* User menu */}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
              <User className="w-4 h-4 text-gray-400" />
              <Link
                to="/profile"
                title="Profile settings"
                className="text-sm text-gray-700 max-w-[120px] truncate hover:text-blue-600"
              >
                {user?.full_name || user?.email}
              </Link>
              <Link
                to="/profile"
                title="API Key settings"
                className={`p-1.5 rounded transition-colors ${isActive('/profile') ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
              >
                <KeyRound className="w-4 h-4" />
              </Link>
              <button
                onClick={logout}
                title="Sign out"
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            TIP Generator - AI-Powered Technical Implementation Plans
          </p>
        </div>
      </footer>
    </div>
  )
}
