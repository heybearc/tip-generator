import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { FolderOpen, Wand2, Loader2, AlertCircle, Clock, CheckCircle, XCircle, Trash2, Pencil, Check, X, Copy } from 'lucide-react'

const API_URL = '/api'

interface Draft {
  id: number
  title: string
  status: string
  claude_model: string | null
  generation_tokens: number | null
  generation_prompt: string | null
  created_at: string
  generated_at: string | null
}

interface ChunkProgress {
  mode: string
  chunk: number
  total_chunks: number
  sections: number
}

function parseProgress(generation_prompt: string | null): ChunkProgress | null {
  if (!generation_prompt) return null
  try {
    const p = JSON.parse(generation_prompt)
    if (p.mode === 'chunked') return p
  } catch { /* not JSON */ }
  return null
}

export default function DraftsPage() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadDrafts()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const loadDrafts = async () => {
    try {
      const res = await axios.get(`${API_URL}/generate/drafts`)
      const data: Draft[] = res.data
      setDrafts(data)
      const hasGenerating = data.some(d => d.status === 'generating')
      if (hasGenerating && !pollRef.current) {
        pollRef.current = setInterval(async () => {
          const r = await axios.get(`${API_URL}/generate/drafts`)
          const updated: Draft[] = r.data
          setDrafts(updated)
          if (!updated.some(d => d.status === 'generating')) {
            clearInterval(pollRef.current!)
            pollRef.current = null
          }
        }, 5000)
      }
    } catch {
      setError('Failed to load drafts')
    } finally {
      setLoading(false)
    }
  }

  const startRename = (e: { stopPropagation: () => void }, draft: Draft) => {
    e.stopPropagation()
    setRenamingId(draft.id)
    setRenameValue(draft.title)
  }

  const commitRename = async (draftId: number) => {
    const trimmed = renameValue.trim()
    if (!trimmed) { cancelRename(); return }
    try {
      await axios.patch(`${API_URL}/generate/drafts/${draftId}`, { content: '', title: trimmed })
      setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, title: trimmed } : d))
    } catch {
      setError('Rename failed')
    } finally {
      setRenamingId(null)
    }
  }

  const cancelRename = () => { setRenamingId(null); setRenameValue('') }

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

  const handleDuplicate = async (e: { stopPropagation: () => void }, draftId: number) => {
    e.stopPropagation()
    try {
      const res = await axios.post(`${API_URL}/generate/drafts/${draftId}/duplicate`)
      setDrafts(prev => [res.data, ...prev])
    } catch {
      setError('Failed to duplicate draft')
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
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {statusIcon(draft.status)}
                <div className="flex-1 min-w-0">
                  {renamingId === draft.id ? (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(draft.id); if (e.key === 'Escape') cancelRename() }}
                        onBlur={() => commitRename(draft.id)}
                        className="flex-1 text-sm font-medium border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button onMouseDown={() => commitRename(draft.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                      <button onMouseDown={cancelRename} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="font-medium text-gray-900">{draft.title}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(draft.created_at).toLocaleString()}
                    {draft.generation_tokens && ` · ${draft.generation_tokens.toLocaleString()} tokens`}
                  </div>
                  {renamingId !== draft.id && draft.status === 'generating' && (() => {
                    const p = parseProgress(draft.generation_prompt)
                    if (!p) return null
                    const pct = p.total_chunks > 0 ? Math.round((p.chunk / p.total_chunks) * 100) : 0
                    return (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-blue-600 mb-1">
                          <span>Generating section {p.chunk} of {p.total_chunks}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-blue-100 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusClass(draft.status)}`}>
                  {draft.status}
                </span>
                {renamingId !== draft.id && (
                  <button
                    onClick={e => startRename(e, draft)}
                    className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                    title="Rename draft"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={e => handleDuplicate(e, draft.id)}
                  className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                  title="Duplicate draft"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
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
