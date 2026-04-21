import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Wand2, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

const API_URL = '/api'

interface Document {
  id: number
  original_filename: string
  document_type: string
  status: string
  file_size: number
  created_at: string
}

interface CurrentTemplate {
  id: number
  filename: string
  version: number
}

interface ProgressState {
  draftId: number
  title: string
  status: string
  chunk: number
  totalChunks: number
  tokens: number | null
}

export default function GeneratePage() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [currentTemplate, setCurrentTemplate] = useState<CurrentTemplate | null>(null)
  const [discoveryDocId, setDiscoveryDocId] = useState<number | null>(null)
  const [serviceOrderDocId, setServiceOrderDocId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    setProgress(null)
    if (pollRef.current) clearInterval(pollRef.current)

    try {
      const createRes = await axios.post(`${API_URL}/generate/draft`, {
        title: title.trim(),
        description: description.trim() || null,
        discovery_document_id: discoveryDocId,
        service_order_document_id: serviceOrderDocId,
      })
      const draftId = createRes.data.id

      await axios.post(`${API_URL}/generate/tip`, { draft_id: draftId })

      setProgress({ draftId, title: title.trim(), status: 'generating', chunk: 0, totalChunks: 0, tokens: null })

      pollRef.current = setInterval(async () => {
        try {
          const res = await axios.get(`${API_URL}/generate/drafts/${draftId}/progress`)
          const data = res.data
          setProgress({
            draftId,
            title: data.title,
            status: data.status,
            chunk: data.progress?.chunk ?? 0,
            totalChunks: data.progress?.total_chunks ?? 0,
            tokens: data.generation_tokens,
          })
          if (data.status === 'completed') {
            clearInterval(pollRef.current!)
            pollRef.current = null
            setGenerating(false)
            navigate(`/drafts/${draftId}`)
          } else if (data.status === 'failed') {
            clearInterval(pollRef.current!)
            pollRef.current = null
            setGenerating(false)
            setError('Generation failed — check Drafts for details')
          }
        } catch {
          // transient error, keep polling
        }
      }, 2000)

    } catch (err: any) {
      setError(err.response?.data?.detail || 'Generation failed')
      setGenerating(false)
    }
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

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

      {/* Inline progress panel — shown while generating */}
      {progress && (
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <div className="flex items-center gap-3">
            {progress.status === 'generating' ? (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900">{progress.title}</p>
              {progress.status === 'generating' && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {progress.totalChunks > 0
                    ? `Generating section ${progress.chunk} of ${progress.totalChunks}…`
                    : 'Starting generation…'}
                </p>
              )}
              {progress.status === 'completed' && (
                <p className="text-sm text-green-600 mt-0.5">Complete — redirecting…</p>
              )}
            </div>
            {progress.tokens && (
              <span className="text-xs text-gray-400">{progress.tokens.toLocaleString()} tokens</span>
            )}
          </div>

          {progress.totalChunks > 0 && (
            <div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((progress.chunk / progress.totalChunks) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Chunk {progress.chunk} / {progress.totalChunks}</span>
                <span>{Math.round((progress.chunk / progress.totalChunks) * 100)}%</span>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">Large documents take 2–4 minutes. You'll be taken directly to the draft when done.</p>
        </div>
      )}
    </div>
  )
}
