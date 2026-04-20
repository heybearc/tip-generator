import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Edit3, Save, X, MessageSquare, Send, Loader2, CheckCircle, AlertCircle, Download, ChevronDown, ChevronRight } from 'lucide-react'

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

// Render a single line of markdown into JSX
function renderLine(line: string, key: number) {
  if (line.startsWith('# '))
    return <h1 key={key} className="text-xl font-bold mt-6 mb-2 pb-1 border-b-2 border-gray-200" style={{ color: '#11171B' }}>{line.slice(2)}</h1>
  if (line.startsWith('## '))
    return <h2 key={key} className="text-base font-semibold mt-4 mb-1" style={{ color: '#44545B' }}>{line.slice(3)}</h2>
  if (line.startsWith('### '))
    return <h3 key={key} className="text-sm font-semibold mt-3 mb-1" style={{ color: '#8C9A9E' }}>{line.slice(4)}</h3>
  if (line.startsWith('> '))
    return <blockquote key={key} className="border-l-4 pl-3 my-1 italic text-sm" style={{ borderColor: '#8C9A9E', color: '#44545B' }}>{line.slice(2)}</blockquote>
  if (line.startsWith('- [ ] ') || line.startsWith('[ ] '))
    return <div key={key} className="flex items-start gap-2 text-sm my-0.5 ml-4"><span className="mt-0.5">☐</span><span>{line.replace(/^[-\s]*\[\s\]\s*/, '')}</span></div>
  if (line.startsWith('- [x] ') || line.startsWith('[x] '))
    return <div key={key} className="flex items-start gap-2 text-sm my-0.5 ml-4 text-gray-500"><span className="mt-0.5">☑</span><span className="line-through">{line.replace(/^[-\s]*\[x\]\s*/, '')}</span></div>
  if (line.startsWith('- ') || line.startsWith('* '))
    return <li key={key} className="ml-5 text-sm mb-0.5 text-gray-800">{line.slice(2)}</li>
  if (line.trim() === '---' || line.trim() === '***')
    return <hr key={key} className="my-3 border-gray-200" />
  if (line.trim() === '')
    return <div key={key} className="h-2" />
  // Inline bold/italic
  const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  return (
    <p key={key} className="text-sm mb-1 text-gray-800 leading-relaxed">
      {parts.map((part, pi) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={pi}>{part.slice(2, -2)}</strong>
        if (part.startsWith('*') && part.endsWith('*')) return <em key={pi}>{part.slice(1, -1)}</em>
        if (part.startsWith('`') && part.endsWith('`')) return <code key={pi} className="bg-gray-100 px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>
        return part
      })}
    </p>
  )
}

function SectionEditor({
  sectionKey,
  content,
  onSave,
}: {
  sectionKey: string
  content: string
  onSave: (key: string, value: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(content)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(sectionKey, value)
    setSaving(false)
    setEditing(false)
  }

  const lines = content.split('\n')
  const preview = lines.slice(0, 3).join(' ').slice(0, 120)

  return (
    <div className="border rounded-xl overflow-hidden mb-3">
      {/* Section header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => { setExpanded(!expanded); setEditing(false) }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <span className="font-semibold text-sm text-gray-900 truncate">{sectionKey}</span>
        </div>
        {!expanded && <span className="text-xs text-gray-400 ml-4 truncate max-w-xs hidden md:block">{preview}…</span>}
        {expanded && !editing && (
          <button
            onClick={e => { e.stopPropagation(); setEditing(true) }}
            className="ml-4 flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded bg-white border border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
          >
            <Edit3 className="w-3 h-3" /> Edit
          </button>
        )}
        {editing && (
          <div className="ml-4 flex-shrink-0 flex gap-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setEditing(false); setValue(content) }}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
            </button>
          </div>
        )}
      </div>

      {/* Section body */}
      {expanded && (
        <div className="p-4 bg-white">
          {editing ? (
            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              className="w-full min-h-[200px] p-3 font-mono text-sm border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <div className="prose-tip">
              {content.split('\n').map((line, i) => renderLine(line, i))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DraftViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // AI Chat
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadDraft() }, [id])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const loadDraft = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_URL}/generate/drafts/${id}`)
      setDraft(res.data)
    } catch {
      setError('Failed to load draft')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSection = async (sectionKey: string, content: string) => {
    if (!draft) return
    await axios.patch(
      `${API_URL}/generate/drafts/${draft.id}/sections/${encodeURIComponent(sectionKey)}`,
      { content }
    )
    setDraft(prev => prev ? {
      ...prev,
      sections: { ...(prev.sections || {}), [sectionKey]: content }
    } : prev)
  }

  const handleExport = async () => {
    if (!draft) return
    setExporting(true)
    try {
      const res = await axios.get(`${API_URL}/generate/drafts/${draft.id}/export`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${draft.title.replace(/[^\w\s-]/g, '').trim()}.docx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !draft) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatLoading(true)

    const contextContent = activeSectionKey && draft.sections
      ? draft.sections[activeSectionKey] || ''
      : draft.content || ''

    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userMsg }]
    setChatMessages(newMessages)

    try {
      const res = await axios.post(`${API_URL}/generate/drafts/${draft.id}/refine`, {
        instruction: userMsg,
        current_content: contextContent
      })
      const assistantMsg: ChatMessage = { role: 'assistant', content: res.data.suggestion }
      setChatMessages([...newMessages, assistantMsg])
    } catch {
      setChatMessages([...newMessages, { role: 'assistant', content: 'Sorry, I could not process that. Please try again.' }])
    } finally {
      setChatLoading(false)
    }
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

  const sectionEntries = draft.sections ? Object.entries(draft.sections) : []

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/drafts')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{draft.title}</h1>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                draft.status === 'completed' ? 'bg-green-100 text-green-700' :
                draft.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>{draft.status}</span>
              {draft.claude_model && <span>{draft.claude_model}</span>}
              {draft.generation_tokens && <span>{draft.generation_tokens.toLocaleString()} tokens</span>}
              {sectionEntries.length > 0 && <span>{sectionEntries.length} sections</span>}
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
          <button
            onClick={handleExport}
            disabled={exporting || draft.status !== 'completed'}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export .docx
          </button>
        </div>
      </div>

      <div className={`grid gap-4 ${chatOpen ? 'grid-cols-3' : 'grid-cols-1'}`}>
        {/* Sections */}
        <div className={`${chatOpen ? 'col-span-2' : 'col-span-1'} max-h-[78vh] overflow-y-auto pr-1`}>
          {sectionEntries.length > 0 ? (
            sectionEntries.map(([key, value]) => (
              <SectionEditor
                key={key}
                sectionKey={key}
                content={value || ''}
                onSave={handleSaveSection}
              />
            ))
          ) : draft.content ? (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              {draft.content.split('\n').map((line, i) => renderLine(line, i))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-3" />
                <p>No content generated yet</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Chat Panel */}
        {chatOpen && (
          <div className="col-span-1 bg-white rounded-xl border shadow-sm flex flex-col h-[78vh]">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-sm">AI Assist</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeSectionKey && (
              <div className="px-3 py-2 bg-purple-50 border-b text-xs text-purple-700 flex items-center justify-between">
                <span>Context: <strong>{activeSectionKey}</strong></span>
                <button onClick={() => setActiveSectionKey(null)} className="text-purple-400 hover:text-purple-700"><X className="w-3 h-3" /></button>
              </div>
            )}

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
                    ].map(s => (
                      <button key={s} onClick={() => setChatInput(s)}
                        className="block w-full text-left text-xs px-3 py-2 bg-gray-50 hover:bg-purple-50 hover:text-purple-700 rounded-lg border border-gray-200 transition-colors"
                      >{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => {
                          if (activeSectionKey) {
                            handleSaveSection(activeSectionKey, msg.content)
                          }
                        }}
                        className="mt-2 text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        {activeSectionKey ? `Apply to "${activeSectionKey}"` : 'Copy suggestion'}
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
