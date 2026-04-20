import { useState, useEffect } from 'react'
import { Upload, FileText, Download, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Template {
  id: number
  filename: string
  file_size: number
  version: number
  is_active: boolean
  notes: string | null
  created_at: string
}

interface TemplateStructure {
  sections: Array<{
    level: number
    title: string
    content: string
    placeholders: string[]
  }>
  placeholders: Array<{
    name: string
    occurrences: number
  }>
  instructions: Array<{
    text: string
    section: string
    type: string
  }>
  metadata: {
    total_paragraphs: number
    total_sections: number
    total_placeholders: number
    styles_used: string[]
  }
}

export default function TemplateManagementPage() {
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null)
  const [templateStructure, setTemplateStructure] = useState<TemplateStructure | null>(null)
  const [showStructure, setShowStructure] = useState(false)
  const [loadingStructure, setLoadingStructure] = useState(false)
  const [history, setHistory] = useState<Template[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadCurrentTemplate()
    loadHistory()
  }, [])

  const loadCurrentTemplate = async () => {
    try {
      const response = await axios.get(`${API_URL}/templates/current`)
      setCurrentTemplate(response.data)
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Failed to load current template:', err)
      }
    }
  }

  const loadHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/templates/history`)
      setHistory(response.data)
    } catch (err) {
      console.error('Failed to load template history:', err)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.docx')) {
      setError('Only .docx files are allowed')
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('notes', `Uploaded ${file.name}`)

    try {
      const response = await axios.post(`${API_URL}/templates/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setSuccess(response.data.message)
      await loadCurrentTemplate()
      await loadHistory()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      event.target.value = '' // Reset file input
    }
  }

  const handleActivateTemplate = async (templateId: number) => {
    try {
      await axios.post(`${API_URL}/templates/${templateId}/activate`)
      setSuccess('Template activated successfully')
      await loadCurrentTemplate()
      await loadHistory()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to activate template')
    }
  }

  const handleDownload = (templateId: number) => {
    window.open(`${API_URL}/templates/download/${templateId}`, '_blank')
  }

  const loadTemplateStructure = async (templateId: number) => {
    setLoadingStructure(true)
    try {
      const response = await axios.get(`${API_URL}/templates/${templateId}/structure`)
      setTemplateStructure(response.data)
      setShowStructure(true)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Template structure not available. Template may need to be re-uploaded.')
      } else {
        setError('Failed to load template structure')
      }
    } finally {
      setLoadingStructure(false)
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

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-2">Template Management</h2>
      <p className="text-gray-600 mb-8">
        Manage TIP document templates. Upload new versions or revert to previous ones.
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

      {/* Current Template */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          Current Active Template
        </h3>

        {currentTemplate ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <FileText className="w-12 h-12 text-blue-600" />
                <div>
                  <h4 className="font-semibold text-lg">{currentTemplate.filename}</h4>
                  <div className="text-sm text-gray-600 space-y-1 mt-2">
                    <div>Version: {currentTemplate.version}</div>
                    <div>Size: {formatFileSize(currentTemplate.file_size)}</div>
                    <div>Uploaded: {formatDate(currentTemplate.created_at)}</div>
                    {currentTemplate.notes && <div>Notes: {currentTemplate.notes}</div>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => showStructure ? setShowStructure(false) : loadTemplateStructure(currentTemplate.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={loadingStructure}
                >
                  {showStructure ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {loadingStructure ? 'Loading...' : showStructure ? 'Hide Structure' : 'View Structure'}
                </button>
                <button
                  onClick={() => handleDownload(currentTemplate.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>

            {/* Template Structure Preview */}
            {showStructure && templateStructure && (
              <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Template Structure</h3>
                
                {/* Metadata Summary */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{templateStructure.metadata.total_sections}</div>
                    <div className="text-sm text-gray-600">Sections</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{templateStructure.placeholders.length}</div>
                    <div className="text-sm text-gray-600">Placeholders</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{templateStructure.instructions.length}</div>
                    <div className="text-sm text-gray-600">Instructions</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{templateStructure.metadata.total_paragraphs}</div>
                    <div className="text-sm text-gray-600">Paragraphs</div>
                  </div>
                </div>

                {/* Sections List */}
                <div className="mb-6">
                  <h4 className="font-semibold mb-3">Sections ({templateStructure.sections.length})</h4>
                  <div className="max-h-96 overflow-y-auto border rounded-lg">
                    {templateStructure.sections.map((section, idx) => (
                      <div
                        key={idx}
                        className="p-3 border-b last:border-b-0 hover:bg-gray-50"
                        style={{ paddingLeft: `${section.level * 1.5}rem` }}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-mono text-gray-500">H{section.level}</span>
                          <span className="font-medium">{section.title}</span>
                        </div>
                        {section.placeholders.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            Placeholders: {section.placeholders.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Placeholders */}
                {templateStructure.placeholders.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold mb-3">Placeholders ({templateStructure.placeholders.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {templateStructure.placeholders.map((ph, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-mono"
                        >
                          {`{{${ph.name}}}`} ({ph.occurrences}x)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                {templateStructure.instructions.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Claude Instructions ({templateStructure.instructions.length})</h4>
                    <div className="space-y-2">
                      {templateStructure.instructions.map((inst, idx) => (
                        <div key={idx} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-800 rounded">
                              {inst.type}
                            </span>
                            <span className="text-xs text-gray-600">{inst.section}</span>
                          </div>
                          <div className="text-sm text-gray-700">{inst.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>No template uploaded yet</p>
          </div>
        )}
      </div>

      {/* Upload New Template */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-600" />
          Upload New Template
        </h3>

        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <strong>Warning:</strong> Uploading a new template will replace the current active template.
            Previous versions will be saved in history.
          </div>

          <div>
            <label className="block">
              <span className="sr-only">Choose template file</span>
              <input
                type="file"
                accept=".docx"
                onChange={handleFileUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </label>
            <p className="mt-2 text-sm text-gray-500">
              Only .docx files are accepted. Maximum size: 10MB
            </p>
          </div>

          {uploading && (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Uploading...</span>
            </div>
          )}
        </div>
      </div>

      {/* Version History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          Version History
        </h3>

        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((template) => (
              <div
                key={template.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  template.is_active
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <FileText className={`w-8 h-8 ${template.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <div className="font-medium">
                      {template.filename}
                      {template.is_active && (
                        <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Version {template.version} • {formatFileSize(template.file_size)} • {formatDate(template.created_at)}
                    </div>
                    {template.notes && (
                      <div className="text-sm text-gray-500 mt-1">{template.notes}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(template.id)}
                    className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Download
                  </button>
                  {!template.is_active && (
                    <button
                      onClick={() => handleActivateTemplate(template.id)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>No template history yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
