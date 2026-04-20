import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { FolderOpen, Wand2, Loader2, AlertCircle, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react'

const API_URL = '/api'

interface Draft {
  id: number
  title: string
  status: string
  claude_model: string | null
  generation_tokens: number | null
  created_at: string
  generated_at: string | null
}

export default function DraftsPage() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadDrafts() }, [])

  const loadDrafts = async () => {
    try {
      const res = await axios.get(`${API_URL}/generate/drafts`)
      setDrafts(res.data)
    } catch {
      setError('Failed to load drafts')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (e: { stopPropagation: () => void }, draftId: number) => {
    e.stopPropagation()
    if (!confirm('Delete this draft?')) return
    try {
      await axios.delete(`${API_URL}/generate/drafts/${draftId}`)
      setDrafts(prev => prev.filter(d => d.id !== draftId))
    } catch {
      setError('Failed to delete draft')
    }
  }

  const statusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-green-500" />
    if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500" />
    if (status === 'generating') return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
    return <Clock className="w-4 h-4 text-gray-400" />
  }

  const statusClass = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-700'
    if (status === 'failed') return 'bg-red-100 text-red-700'
    if (status === 'generating') return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-600'
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drafts</h1>
          <p className="text-gray-500 text-sm mt-1">{drafts.length} TIP{drafts.length !== 1 ? 's' : ''} generated</p>
        </div>
        <button
          onClick={() => navigate('/generate')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Wand2 className="w-4 h-4" />
          New TIP
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {drafts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border">
          <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No drafts yet</p>
          <button
            onClick={() => navigate('/generate')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Generate your first TIP
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map(draft => (
            <div
              key={draft.id}
              onClick={() => navigate(`/drafts/${draft.id}`)}
              className="bg-white border rounded-xl p-4 flex items-center justify-between hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3">
                {statusIcon(draft.status)}
                <div>
                  <div className="font-medium text-gray-900">{draft.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(draft.created_at).toLocaleString()}
                    {draft.generation_tokens && ` · ${draft.generation_tokens.toLocaleString()} tokens`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusClass(draft.status)}`}>
                  {draft.status}
                </span>
                <button
                  onClick={e => handleDelete(e, draft.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Delete draft"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-gray-400">→</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
