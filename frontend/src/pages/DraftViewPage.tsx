import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { ArrowLeft, Edit3, Save, X, Loader2, CheckCircle, AlertCircle, Download, ChevronDown, ChevronRight, Sparkles, BookOpen, Pencil, Check, ClipboardList, Users, UserPlus, UserMinus, Layers } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import TipTapEditor from '../components/TipTapEditor'
import SectionManager from '../components/SectionManager'

const API_URL = '/api'

interface Draft {
  id: number
  user_id: number
  title: string
  status: string
  content: string | null
  sections: Record<string, string> | null
  claude_model: string | null
  generation_tokens: number | null
  library_examples_used: { title: string; category: string }[] | null
  created_at: string
  generated_at: string | null
}

interface Collaborator {
  user_id: number
  username: string
  full_name: string | null
  invited_by_username: string
}

interface Gap {
  section: string | null
  placeholder: string
  detail: string
}


const BRAND = '#143F6A'

const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => <h1 className="text-base font-bold mt-6 mb-1 pb-1 border-b-2" style={{ color: BRAND, borderColor: BRAND }}>{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mt-4 mb-1 pb-0.5 border-b" style={{ color: BRAND, borderColor: BRAND }}>{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1" style={{ color: BRAND }}>{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1 text-gray-700">{children}</h4>,
  p:  ({ children }) => <p className="text-sm mb-1 text-gray-800 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc ml-5 mb-2 space-y-0.5 text-sm text-gray-800">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ml-5 mb-2 space-y-0.5 text-sm text-gray-800">{children}</ol>,
  li: ({ children }) => <li className="text-sm text-gray-800">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-4 pl-3 my-1 italic text-sm" style={{ borderColor: BRAND, color: BRAND }}>{children}</blockquote>,
  hr: () => <hr className="my-3" style={{ borderColor: BRAND }} />,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  code: ({ children }) => <code className="bg-gray-100 px-1 rounded text-xs font-mono">{children}</code>,
  pre: ({ children }) => <pre className="bg-gray-100 rounded p-2 overflow-x-auto text-xs font-mono my-2">{children}</pre>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse border" style={{ borderColor: '#d1d5db' }}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead style={{ backgroundColor: BRAND }}>{children}</thead>,
  th: ({ children }) => <th className="px-3 py-1.5 text-left text-xs font-semibold text-white border" style={{ borderColor: '#1e5489' }}>{children}</th>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children, ...props }) => {
    const isEven = (props as { 'data-row-index'?: number })?.['data-row-index'] !== undefined
    return <tr className={isEven ? 'bg-gray-50' : 'bg-white'} style={{ borderBottom: '1px solid #e5e7eb' }}>{children}</tr>
  },
  td: ({ children }) => <td className="px-3 py-1.5 text-sm text-gray-800 border" style={{ borderColor: '#e5e7eb' }}>{children}</td>,
}

function MarkdownView({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={mdComponents}
    >
      {content}
    </ReactMarkdown>
  )
}

const REFINE_MODES = [
  { value: 'tighten', label: 'Tighten', description: 'Condense by 30–50%, remove wordiness' },
  { value: 'comply',  label: 'Apply Template', description: 'Restructure to match template instructions' },
  { value: 'risks',   label: 'Fix Risks Format', description: 'Reformat risks into 4-field structure' },
  { value: 'both',    label: 'Tighten + Apply', description: 'Condense AND apply template structure' },
  { value: 'custom',  label: 'Custom', description: 'Free-text instruction' },
]

function SectionEditor({
  draftId,
  sectionKey,
  content,
  onSave,
  libraryInfluenced,
}: {
  draftId: number
  sectionKey: string
  content: string
  onSave: (key: string, value: string) => Promise<void>
  libraryInfluenced?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(content)
  const [saving, setSaving] = useState(false)
  const [refineOpen, setRefineOpen] = useState(false)
  const [refineMode, setRefineMode] = useState('tighten')
  const [refineCustomText, setRefineCustomText] = useState('')
  const [refining, setRefining] = useState(false)
  const [refinedPreview, setRefinedPreview] = useState<string | null>(null)
  const [refineInstruction, setRefineInstruction] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    await onSave(sectionKey, value)
    setSaving(false)
    setEditing(false)
  }

  const handleRefine = async () => {
    setRefining(true)
    setRefinedPreview(null)
    try {
      const res = await axios.post(`${API_URL}/generate/drafts/${draftId}/refine-guided`, {
        section_key: sectionKey,
        current_content: value || content,
        mode: refineMode,
        custom_instruction: refineMode === 'custom' ? refineCustomText : undefined,
      })
      setRefinedPreview(res.data.suggestion)
      setRefineInstruction(res.data.instruction_used)
    } catch {
      setRefinedPreview('Error: refinement failed. Please try again.')
    } finally {
      setRefining(false)
    }
  }

  const applyRefined = () => {
    if (refinedPreview) {
      setValue(refinedPreview)
      setEditing(true)
      setRefinedPreview(null)
      setRefineOpen(false)
    }
  }

  const lines = content.split('\n')
  const preview = lines.slice(0, 3).join(' ').slice(0, 120)
  const wordCount = content.split(/\s+/).filter(Boolean).length

  return (
    <div className="border rounded-xl overflow-hidden mb-3">
      {/* Section header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => { setExpanded(!expanded); setEditing(false); setRefineOpen(false) }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <span className="font-semibold text-sm text-gray-900 truncate">{sectionKey}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{wordCount}w</span>
          {libraryInfluenced && (
            <span title="Content influenced by TIP Library examples" className="flex-shrink-0">
              <BookOpen className="w-3 h-3 text-purple-400" />
            </span>
          )}
        </div>
        {!expanded && <span className="text-xs text-gray-400 ml-4 truncate max-w-xs hidden md:block">{preview}…</span>}
        {expanded && !editing && (
          <div className="ml-4 flex-shrink-0 flex gap-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setRefineOpen(!refineOpen)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                refineOpen ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-gray-300 text-gray-600 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700'
              }`}
            >
              <Sparkles className="w-3 h-3" /> Refine
            </button>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-white border border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
            >
              <Edit3 className="w-3 h-3" /> Edit
            </button>
          </div>
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

      {/* Template-guided refine panel */}
      {expanded && refineOpen && !editing && (
        <div className="border-t bg-amber-50 px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-amber-800">Refine per Thrive template</span>
            {refineInstruction && (
              <span className="text-xs text-amber-600 italic truncate max-w-xs" title={refineInstruction}>
                Template says: {refineInstruction.slice(0, 60)}…
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {REFINE_MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setRefineMode(m.value)}
                title={m.description}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  refineMode === m.value
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400 hover:text-amber-700'
                }`}
              >
                {m.label}
              </button>
            ))}
            {refineMode !== 'custom' && (
              <button
                onClick={handleRefine}
                disabled={refining}
                className="ml-auto flex items-center gap-1 text-xs px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {refining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {refining ? 'Refining…' : 'Run'}
              </button>
            )}
          </div>
          {refineMode === 'custom' && (
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={refineCustomText}
                onChange={e => setRefineCustomText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !refining && refineCustomText.trim() && handleRefine()}
                placeholder="e.g. Convert bullets to numbered steps, remove the 3rd paragraph…"
                className="flex-1 text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                onClick={handleRefine}
                disabled={refining || !refineCustomText.trim()}
                className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {refining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {refining ? 'Refining…' : 'Run'}
              </button>
            </div>
          )}
          {refinedPreview && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-600">
                  Preview ({refinedPreview.split(/\s+/).filter(Boolean).length}w vs {wordCount}w original)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRefinedPreview(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >Discard</button>
                  <button
                    onClick={applyRefined}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                  >
                    <CheckCircle className="w-3 h-3" /> Apply to editor
                  </button>
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto p-3 bg-white border rounded-lg text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {refinedPreview}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section body */}
      {expanded && (
        <div className="p-4 bg-white">
          {editing ? (
            <TipTapEditor value={value} onChange={setValue} />
          ) : (
            <div className="prose-tip">
              <MarkdownView content={content} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DocRefinePanel({ draftId, onApplyAll }: { draftId: number; onApplyAll: (sections: Record<string, string>) => void }) {
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [running, setRunning] = useState(false)
  const [preview, setPreview] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  const handleRun = async () => {
    if (!instruction.trim()) return
    setRunning(true)
    setPreview(null)
    setError(null)
    setApplied(false)
    try {
      const res = await axios.post(`${API_URL}/generate/drafts/${draftId}/refine-all`, { instruction })
      setPreview(res.data.sections)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Refinement failed. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  const handleApply = () => {
    if (preview) {
      onApplyAll(preview)
      setApplied(true)
      setPreview(null)
      setInstruction('')
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          Whole-Document Refine
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t pt-3 space-y-3">
          <p className="text-xs text-gray-500">Apply a single instruction to every section simultaneously. Claude processes all sections in parallel.</p>
          <div className="flex gap-2">
            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder="e.g. Convert all bullet lists to numbered steps&#10;Standardize all headings to sentence case&#10;Remove all [DATA NEEDED] placeholders and replace with TBD"
              rows={3}
              className="flex-1 text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRun}
              disabled={running || !instruction.trim()}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {running ? `Refining all sections…` : 'Run on All Sections'}
            </button>
            {preview && (
              <button
                onClick={handleApply}
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                Apply All ({Object.keys(preview).length} sections)
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {applied && <p className="text-xs text-green-600">✓ All sections updated. Review and save each section.</p>}
          {preview && (
            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 mb-2">Preview — {Object.keys(preview).length} sections revised:</p>
              {Object.entries(preview).map(([key, val]) => (
                <div key={key} className="text-xs border-b pb-2 last:border-0">
                  <p className="font-medium text-gray-700 mb-1">{key}</p>
                  <p className="text-gray-500 line-clamp-2 whitespace-pre-line">{val}</p>
                </div>
              ))}
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
  const { user: currentUser } = useAuth()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [renamingTitle, setRenamingTitle] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  // Collaborators
  const [collabOpen, setCollabOpen] = useState(false)
  const [sectionManagerOpen, setSectionManagerOpen] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [collabLoading, setCollabLoading] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviting, setInviting] = useState(false)
  const [collabError, setCollabError] = useState<string | null>(null)
  const [userSuggestions, setUserSuggestions] = useState<{ username: string; full_name: string | null }[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)


  // Gap report
  const [gapsOpen, setGapsOpen] = useState(false)
  const [gaps, setGaps] = useState<Gap[] | null>(null)
  const [gapsLoading, setGapsLoading] = useState(false)

  useEffect(() => { loadDraft() }, [id])
  useEffect(() => {
    if (collabOpen && id) loadCollaborators()
  }, [collabOpen])
  const loadCollaborators = async () => {
    if (!id) return
    setCollabLoading(true)
    try {
      const res = await axios.get(`${API_URL}/generate/drafts/${id}/collaborators`)
      setCollaborators(res.data)
    } catch {
      /* silently fail */
    } finally {
      setCollabLoading(false)
    }
  }

  const searchUsers = async (q: string) => {
    if (q.length < 2) { setUserSuggestions([]); setSuggestionsOpen(false); return }
    try {
      const res = await axios.get(`${API_URL}/auth/users/search`, { params: { q } })
      const existing = new Set(collaborators.map(c => c.username))
      setUserSuggestions(res.data.filter((u: { username: string }) => !existing.has(u.username)))
      setSuggestionsOpen(true)
    } catch {
      setUserSuggestions([])
    }
  }

  const handleInvite = async () => {
    if (!inviteUsername.trim() || !id) return
    setInviting(true)
    setCollabError(null)
    setSuggestionsOpen(false)
    setUserSuggestions([])
    try {
      const res = await axios.post(`${API_URL}/generate/drafts/${id}/collaborators`, { username: inviteUsername.trim() })
      setCollaborators(prev => [...prev, res.data])
      setInviteUsername('')
    } catch (err: any) {
      setCollabError(err.response?.data?.detail || 'Invite failed')
    } finally {
      setInviting(false)
    }
  }

  const selectSuggestion = (username: string) => {
    setInviteUsername(username)
    setUserSuggestions([])
    setSuggestionsOpen(false)
  }

  const handleRemoveCollab = async (userId: number) => {
    if (!id) return
    try {
      await axios.delete(`${API_URL}/generate/drafts/${id}/collaborators/${userId}`)
      setCollaborators(prev => prev.filter(c => c.user_id !== userId))
    } catch {
      /* silently fail */
    }
  }

  const loadGaps = async () => {
    if (!id) return
    setGapsLoading(true)
    try {
      const res = await axios.get(`${API_URL}/generate/drafts/${id}/gaps`)
      setGaps(res.data.gaps)
    } catch {
      setGaps([])
    } finally {
      setGapsLoading(false)
    }
  }

  const toggleGaps = () => {
    if (!gapsOpen && gaps === null) loadGaps()
    setGapsOpen(prev => !prev)
  }

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

  const startRenameTitle = () => {
    if (!draft) return
    setRenameValue(draft.title)
    setRenamingTitle(true)
  }

  const commitRenameTitle = async () => {
    if (!draft) return
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenamingTitle(false); return }
    try {
      await axios.patch(`${API_URL}/generate/drafts/${draft.id}`, { content: '', title: trimmed })
      setDraft(prev => prev ? { ...prev, title: trimmed } : prev)
    } catch {
      setError('Rename failed')
    } finally {
      setRenamingTitle(false)
    }
  }

  const handleApplyAllSections = async (sections: Record<string, string>) => {
    if (!draft) return
    for (const [key, content] of Object.entries(sections)) {
      await axios.patch(
        `${API_URL}/generate/drafts/${draft.id}/sections/section`,
        { key, content }
      )
    }
    setDraft(prev => prev ? {
      ...prev,
      sections: { ...(prev.sections || {}), ...sections }
    } : prev)
  }

  const handleSaveSection = async (sectionKey: string, content: string) => {
    if (!draft) return
    // Pass key in body to avoid URL encoding issues with slashes in section names
    await axios.patch(
      `${API_URL}/generate/drafts/${draft.id}/sections/section`,
      { key: sectionKey, content }
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

  const handleExportPdf = async () => {
    if (!draft) return
    setExportingPdf(true)
    try {
      const res = await axios.get(`${API_URL}/generate/drafts/${draft.id}/export/pdf`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${draft.title.replace(/[^\w\s-]/g, '').trim()}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('PDF export failed')
    } finally {
      setExportingPdf(false)
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
            {renamingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRenameTitle(); if (e.key === 'Escape') setRenamingTitle(false) }}
                  onBlur={commitRenameTitle}
                  className="text-xl font-bold text-gray-900 border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-96"
                />
                <button onMouseDown={commitRenameTitle} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                <button onMouseDown={() => setRenamingTitle(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{draft.title}</h1>
                <button onClick={startRenameTitle} className="p-1 text-gray-300 hover:text-blue-500 rounded transition-colors" title="Rename">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                draft.status === 'completed' ? 'bg-green-100 text-green-700' :
                draft.status === 'failed' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>{draft.status}</span>
              {draft.claude_model && <span>{draft.claude_model}</span>}
              {draft.generation_tokens && <span>{draft.generation_tokens.toLocaleString()} tokens</span>}
              {sectionEntries.length > 0 && <span>{sectionEntries.length} sections</span>}
              {draft.library_examples_used && draft.library_examples_used.length > 0 && (
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium cursor-default"
                  title={`Library examples used: ${draft.library_examples_used.map(e => e.title).join(', ')}`}
                >
                  <BookOpen className="w-3 h-3" />
                  {draft.library_examples_used.length} library example{draft.library_examples_used.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {draft.status === 'completed' && draft.sections && Object.keys(draft.sections).length > 0 && (
            <button
              onClick={() => setSectionManagerOpen(!sectionManagerOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                sectionManagerOpen ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Manage section order and visibility"
            >
              <Layers className="w-4 h-4" />
              Sections
            </button>
          )}
          <button
            onClick={() => setCollabOpen(!collabOpen)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              collabOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            title="Manage collaborators"
          >
            <Users className="w-4 h-4" />
            {collaborators.length > 0 ? collaborators.length : ''}
          </button>
          {draft.status === 'completed' && (
            <button
              onClick={toggleGaps}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                gapsOpen ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {gapsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
              {gaps !== null ? `Gaps (${gaps.length})` : 'Gaps'}
            </button>
          )}
          <div className="flex rounded-lg overflow-hidden border border-green-600 disabled:opacity-50">
            <button
              onClick={handleExport}
              disabled={exporting || exportingPdf || draft.status !== 'completed'}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed border-r border-green-500"
              title="Download as Word document"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              .docx
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting || exportingPdf || draft.status !== 'completed'}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download as PDF"
            >
              {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              .pdf
            </button>
          </div>
        </div>
      </div>

      {sectionManagerOpen && draft.sections && (
        <SectionManager
          draftId={draft.id}
          onClose={() => setSectionManagerOpen(false)}
        />
      )}

      {collabOpen && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-sm text-blue-800">Collaborators</span>
            {collabLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
          </div>
          {collaborators.length === 0 && !collabLoading && (
            <p className="text-xs text-blue-600 mb-3">No collaborators yet.</p>
          )}
          {collaborators.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {collaborators.map(c => (
                <div key={c.user_id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-blue-100">
                  <div>
                    <span className="font-medium text-gray-800">{c.username}</span>
                    {c.full_name && <span className="text-gray-500 ml-1">({c.full_name})</span>}
                    <span className="text-xs text-gray-400 ml-2">invited by {c.invited_by_username}</span>
                  </div>
                  {currentUser && (draft.user_id === currentUser.id || currentUser.is_superuser || c.user_id === currentUser.id) && (
                    <button
                      onClick={() => handleRemoveCollab(c.user_id)}
                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Remove collaborator"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {currentUser && (draft.user_id === currentUser.id || currentUser.is_superuser) && (
            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteUsername}
                  onChange={e => { setInviteUsername(e.target.value); setCollabError(null); searchUsers(e.target.value) }}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
                  onFocus={() => inviteUsername.length >= 2 && userSuggestions.length > 0 && setSuggestionsOpen(true)}
                  placeholder="Search by name or username…"
                  className="flex-1 text-sm border border-blue-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                />
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteUsername.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  Invite
                </button>
              </div>
              {suggestionsOpen && userSuggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-12 mt-1 bg-white border border-blue-200 rounded-lg shadow-lg overflow-hidden">
                  {userSuggestions.map(u => (
                    <button
                      key={u.username}
                      onMouseDown={() => selectSuggestion(u.username)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-800">{u.username}</span>
                      {u.full_name && <span className="text-gray-400 text-xs">{u.full_name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {collabError && <p className="text-xs text-red-600 mt-2">{collabError}</p>}
        </div>
      )}

      {gapsOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-sm text-amber-800">
              {gapsLoading ? 'Scanning for gaps…' : gaps && gaps.length > 0 ? `${gaps.length} gap${gaps.length !== 1 ? 's' : ''} found — items marked [DATA NEEDED]` : 'No gaps found — all placeholders resolved'}
            </span>
          </div>
          {gaps && gaps.length > 0 && (
            <div className="space-y-1.5">
              {gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div>
                    {g.section && <span className="text-amber-600 font-medium">{g.section}: </span>}
                    <span className="text-gray-700">{g.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1">
        {/* Sections */}
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          {sectionEntries.length > 0 && (
            <DocRefinePanel draftId={draft.id} onApplyAll={handleApplyAllSections} />
          )}
          {sectionEntries.length > 0 ? (
            sectionEntries.map(([key, value]) => (
              <SectionEditor
                key={key}
                draftId={draft.id}
                sectionKey={key}
                content={value || ''}
                onSave={handleSaveSection}
                libraryInfluenced={!!(draft.library_examples_used && draft.library_examples_used.length > 0)}
              />
            ))
          ) : draft.content ? (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <MarkdownView content={draft.content} />
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

      </div>
    </div>
  )
}
