import { useState, useEffect } from 'react'
import axios from 'axios'
import { Wand2, FileText, AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

const API_URL = '/api'

interface Document {
  id: number
  original_filename: string
  document_type: string
  status: string
  file_size: number
  created_at: string
}

interface Draft {
  id: number
  title: string
  status: string
  content: string | null
  claude_model: string | null
  generation_tokens: number | null
  created_at: string
  generated_at: string | null
}

interface CurrentTemplate {
  id: number
  filename: string
  version: number
}

export default function GeneratePage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [currentTemplate, setCurrentTemplate] = useState<CurrentTemplate | null>(null)
  const [discoveryDocId, setDiscoveryDocId] = useState<number | null>(null)
  const [serviceOrderDocId, setServiceOrderDocId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  useEffect(() => {
    loadDocuments()
    loadCurrentTemplate()
  }, [])

  const loadDocuments = async () => {
    try {
      const res = await axios.get(`${API_URL}/documents`)
      setDocuments(res.data.filter((d: Document) => d.status === 'completed'))
    } catch {
      // silent
    }
  }

  const loadCurrentTemplate = async () => {
    try {
      const res = await axios.get(`${API_URL}/templates/current`)
      setCurrentTemplate(res.data)
    } catch {
      // no template set
    }
  }

  const handleGenerate = async () => {
    if (!title.trim()) {
      setError('Please enter a title for this TIP')
      return
    }
    setError(null)
    setGenerating(true)
    setDraft(null)

    try {
      // 1. Create draft
      const createRes = await axios.post(`${API_URL}/generate/draft`, {
        title: title.trim(),
        description: description.trim() || null,
        discovery_document_id: discoveryDocId,
        service_order_document_id: serviceOrderDocId,
      })
      const draftId = createRes.data.id

      // 2. Generate TIP
      const genRes = await axios.post(`${API_URL}/generate/tip`, { draft_id: draftId })

      // 3. Load full draft
      const draftRes = await axios.get(`${API_URL}/generate/drafts/${genRes.data.draft_id}`)
      setDraft(draftRes.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const discoveryDocs = documents.filter(d =>
    d.document_type === 'discovery_excel' || d.document_type === 'other'
  )
  const serviceOrderDocs = documents.filter(d =>
    d.document_type === 'service_order_pdf' || d.document_type === 'other'
  )

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generate TIP</h1>
        <p className="text-gray-600 mt-1">Create a Technical Implementation Plan from your uploaded documents</p>
      </div>

      {/* Active Template Banner */}
      <div className={`rounded-lg p-4 flex items-center gap-3 ${currentTemplate ? 'bg-blue-50 border border-blue-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <FileText className={`w-5 h-5 flex-shrink-0 ${currentTemplate ? 'text-blue-600' : 'text-yellow-600'}`} />
        {currentTemplate ? (
          <span className="text-sm text-blue-800">
            Using template: <strong>{currentTemplate.filename}</strong> (v{currentTemplate.version})
          </span>
        ) : (
          <span className="text-sm text-yellow-800">
            No active template — will use generic TIP structure. Upload a template in <a href="/admin/template" className="underline font-medium">Template Settings</a>.
          </span>
        )}
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
        <h2 className="font-semibold text-lg">TIP Details</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Acme Corp - Server Migration TIP"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Context <span className="text-gray-400">(optional)</span></label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Any additional notes or context for Claude..."
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discovery Worksheet</label>
            <select
              value={discoveryDocId ?? ''}
              onChange={e => setDiscoveryDocId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— None —</option>
              {discoveryDocs.map(d => (
                <option key={d.id} value={d.id}>
                  {d.original_filename} ({formatSize(d.file_size)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Order</label>
            <select
              value={serviceOrderDocId ?? ''}
              onChange={e => setServiceOrderDocId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— None —</option>
              {serviceOrderDocs.map(d => (
                <option key={d.id} value={d.id}>
                  {d.original_filename} ({formatSize(d.file_size)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {documents.length === 0 && (
          <p className="text-sm text-gray-500">
            No documents uploaded yet. <a href="/upload" className="text-blue-600 underline">Upload documents</a> to use them in generation.
          </p>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating || !title.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          ) : (
            <><Wand2 className="w-4 h-4" /> Generate TIP</>
          )}
        </button>
      </div>

      {/* Result */}
      {draft && draft.status === 'completed' && draft.content && (
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-lg">Generated TIP</h2>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              {draft.claude_model && <span>{draft.claude_model}</span>}
              {draft.generation_tokens && <span>{draft.generation_tokens.toLocaleString()} tokens</span>}
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="flex items-center gap-1 px-3 py-1 border rounded-lg hover:bg-gray-50 text-gray-600"
              >
                {showRaw ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showRaw ? 'Formatted' : 'Raw'}
              </button>
            </div>
          </div>

          {showRaw ? (
            <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[600px] border">
              {draft.content}
            </pre>
          ) : (
            <div className="prose prose-sm max-w-none max-h-[600px] overflow-y-auto border rounded-lg p-6 bg-gray-50">
              {draft.content.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>
                if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(3)}</h2>
                if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(4)}</h3>
                if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4">{line.slice(2)}</li>
                if (line.trim() === '') return <br key={i} />
                return <p key={i} className="mb-1">{line}</p>
              })}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t text-sm text-gray-500">
            <span>Draft ID: {draft.id} · <a href="/drafts" className="text-blue-600 hover:underline">View all drafts</a></span>
            <span>Generated {new Date(draft.generated_at!).toLocaleString()}</span>
          </div>
        </div>
      )}

      {draft && draft.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <AlertCircle className="w-5 h-5" />
            Generation Failed
          </div>
          <p className="text-sm text-red-600">{draft.content}</p>
        </div>
      )}
    </div>
  )
}
