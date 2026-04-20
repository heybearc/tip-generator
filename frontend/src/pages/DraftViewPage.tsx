import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Edit3, Save, X, MessageSquare, RefreshCw, Send, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react'

const API_URL = '/api'

interface Draft {
  id: number
  title: string
  status: string
  content: string | null
  sections: Record<string, string> | null
  claude_model: string | null
  generation_tokens: number | null
  created_at: string
  generated_at: string | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function DraftViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Editing
  const [editMode, setEditMode] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [saving, setSaving] = useState(false)

  // AI Chat
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadDraft() }, [id])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const loadDraft = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_URL}/generate/drafts/${id}`)
      setDraft(res.data)
      setEditedContent(res.data.content || '')
    } catch {
      setError('Failed to load draft')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      await axios.patch(`${API_URL}/generate/drafts/${draft.id}`, { content: editedContent })
      setDraft({ ...draft, content: editedContent })
      setEditMode(false)
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !draft) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatLoading(true)

    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userMsg }]
    setChatMessages(newMessages)

    try {
      const res = await axios.post(`${API_URL}/generate/drafts/${draft.id}/refine`, {
        instruction: userMsg,
        current_content: editedContent || draft.content
      })
      const assistantMsg: ChatMessage = { role: 'assistant', content: res.data.suggestion }
      setChatMessages([...newMessages, assistantMsg])
    } catch {
      const errMsg: ChatMessage = { role: 'assistant', content: 'Sorry, I could not process that. Please try again.' }
      setChatMessages([...newMessages, errMsg])
    } finally {
      setChatLoading(false)
    }
  }

  const handleApplySuggestion = (suggestion: string) => {
    setEditedContent(suggestion)
    setEditMode(true)
    setChatOpen(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  if (error || !draft) return (
    <div className="text-center py-20">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <p className="text-gray-600">{error || 'Draft not found'}</p>
      <button onClick={() => navigate('/drafts')} className="mt-4 text-blue-600 hover:underline">← Back to Drafts</button>
    </div>
  )

  const displayContent = editMode ? editedContent : (draft.content || '')

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/drafts')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{draft.title}</h1>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                draft.status === 'completed' ? 'bg-green-100 text-green-700' :
                draft.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>{draft.status}</span>
              {draft.claude_model && <span>{draft.claude_model}</span>}
              {draft.generation_tokens && <span>{draft.generation_tokens.toLocaleString()} tokens</span>}
              {draft.generated_at && <span>Generated {new Date(draft.generated_at).toLocaleString()}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              chatOpen ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            AI Assist
          </button>
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={() => { setEditMode(false); setEditedContent(draft.content || '') }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </>
          )}
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className={`grid gap-4 ${chatOpen ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {/* Main Content */}
        <div className={chatOpen ? 'col-span-2' : 'col-span-1'}>
          <div className="bg-white rounded-xl border shadow-sm">
            {editMode ? (
              <textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                className="w-full h-[70vh] p-6 font-mono text-sm rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div className="p-6 h-[70vh] overflow-y-auto">
                {displayContent ? (
                  <div className="prose prose-sm max-w-none">
                    {displayContent.split('\n').map((line, i) => {
                      if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 mb-3 pb-2 border-b">{line.slice(2)}</h1>
                      if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold mt-5 mb-2">{line.slice(3)}</h2>
                      if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>
                      if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-6 mb-1">{line.slice(2)}</li>
                      if (line.trim() === '') return <div key={i} className="h-3" />
                      return <p key={i} className="mb-2 text-gray-800 leading-relaxed">{line}</p>
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3" />
                      <p>No content generated yet</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* AI Chat Panel */}
        {chatOpen && (
          <div className="col-span-1 bg-white rounded-xl border shadow-sm flex flex-col h-[70vh]">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-sm">AI Assist</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500 mb-4">Ask Claude to help improve this TIP</p>
                  <div className="space-y-2">
                    {[
                      'Make the executive summary more concise',
                      'Add more technical detail to the implementation section',
                      'Rewrite in a more formal tone',
                      'Identify any missing sections',
                    ].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setChatInput(suggestion)}
                        className="block w-full text-left text-xs px-3 py-2 bg-gray-50 hover:bg-purple-50 hover:text-purple-700 rounded-lg border border-gray-200 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => handleApplySuggestion(msg.content)}
                        className="mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Apply to editor
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
                  placeholder="Ask Claude to improve this TIP..."
                  className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
