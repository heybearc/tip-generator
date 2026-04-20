import { useState, useEffect } from 'react'
import { FileText, Trash2, AlertCircle, CheckCircle } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Document {
  id: number
  filename: string
  original_filename: string
  file_size: number
  mime_type: string
  document_type: string
  status: string
  created_at: string
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${API_URL}/documents`)
      setDocuments(response.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return
    }

    try {
      await axios.delete(`${API_URL}/documents/${id}`)
      setSuccess(`Deleted "${filename}"`)
      setDocuments(prev => prev.filter(d => d.id !== id))
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete document')
      setTimeout(() => setError(null), 5000)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'discovery_excel': 'Discovery Worksheet',
      'service_order_pdf': 'Service Order',
      'other': 'Other'
    }
    return labels[type] || type
  }

  const getDocumentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'discovery_excel': 'bg-green-100 text-green-800',
      'service_order_pdf': 'bg-blue-100 text-blue-800',
      'other': 'bg-gray-100 text-gray-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const filteredDocuments = documents.filter(doc => {
    if (filter === 'all') return true
    return doc.document_type === filter
  })

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-2">Document Management</h2>
      <p className="text-gray-600 mb-8">
        View and manage your uploaded documents
      </p>

      {/* Alert Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-green-800">{success}</div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({documents.length})
        </button>
        <button
          onClick={() => setFilter('discovery_excel')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'discovery_excel'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Discovery ({documents.filter(d => d.document_type === 'discovery_excel').length})
        </button>
        <button
          onClick={() => setFilter('service_order_pdf')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'service_order_pdf'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Service Orders ({documents.filter(d => d.document_type === 'service_order_pdf').length})
        </button>
        <button
          onClick={() => setFilter('other')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'other'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Other ({documents.filter(d => d.document_type === 'other').length})
        </button>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            Loading documents...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No documents found</p>
            <p className="text-sm">Upload documents to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <FileText className="w-10 h-10 text-blue-600 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg truncate">
                          {doc.original_filename}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded ${getDocumentTypeColor(doc.document_type)}`}>
                          {getDocumentTypeLabel(doc.document_type)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Size: {formatFileSize(doc.file_size)}</div>
                        <div>Uploaded: {formatDate(doc.created_at)}</div>
                        <div className="text-xs text-gray-500">ID: {doc.id}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleDelete(doc.id, doc.original_filename)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {!loading && documents.length > 0 && (
        <div className="mt-6 text-sm text-gray-600">
          Showing {filteredDocuments.length} of {documents.length} documents
        </div>
      )}
    </div>
  )
}
