import { useEffect, useState } from 'react'
import React from 'react'
import { Library, Search, Tag, FileText, CheckCircle, Clock, XCircle, Upload, Trash2, Sparkles, Pencil, Check, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface LibraryDoc {
  id: number
  title: string
  category: string
  category_suggested: boolean
  description: string | null
  original_filename: string
  file_size: number | null
  mime_type: string | null
  status: string
  uploaded_by_username: string
  approved_by_username: string | null
  approved_at: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  approved: { label: 'Approved', icon: <CheckCircle className="w-3.5 h-3.5" />, cls: 'text-green-700 bg-green-50 border-green-200' },
  pending:  { label: 'Pending',  icon: <Clock className="w-3.5 h-3.5" />,       cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  rejected: { label: 'Rejected', icon: <XCircle className="w-3.5 h-3.5" />,     cls: 'text-red-700 bg-red-50 border-red-200' },
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function LibraryPage() {
  const { user } = useAuth()
  const isAdmin = user?.is_superuser ?? false

  const [docs, setDocs] = useState<LibraryDoc[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>(isAdmin ? 'all' : 'approved')

  // Upload form state
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Inline edit state: docId -> { title, category } draft
  const [editing, setEditing] = useState<Record<number, { title: string; category: string }>>({})
  const [saving, setSaving] = useState<number | null>(null)

  const fetchDocs = async () => {
    setLoading(true)
    try {
      const url = isAdmin ? '/api/library/all' : '/api/library'
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load library')
      setDocs(await res.json())
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/library/categories', { credentials: 'include' })
      if (res.ok) setCategories(await res.json())
    } catch {}
  }

  useEffect(() => {
    fetchDocs()
    fetchCategories()
  }, [])

  const handleApprove = async (id: number) => {
    await fetch(`/api/library/${id}/approve`, { method: 'PATCH', credentials: 'include' })
    fetchDocs()
    fetchCategories()
  }

  const handleReject = async (id: number) => {
    if (!confirm('Reject this document?')) return
    await fetch(`/api/library/${id}/reject`, { method: 'PATCH', credentials: 'include' })
    fetchDocs()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this library document? This cannot be undone.')) return
    await fetch(`/api/library/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchDocs()
    fetchCategories()
  }

  const startEditing = (doc: LibraryDoc) => {
    setEditing(prev => ({ ...prev, [doc.id]: { title: doc.title, category: doc.category } }))
  }

  const cancelEditing = (id: number) => {
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const handleSaveDoc = async (id: number) => {
    const draft = editing[id]
    if (!draft) return
    if (!draft.title.trim()) return
    setSaving(id)
    try {
      const res = await fetch(`/api/library/${id}/update`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: draft.title.trim(), category: draft.category.trim() }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated: LibraryDoc = await res.json()
      setDocs(prev => prev.map(d => d.id === id ? updated : d))
      cancelEditing(id)
      fetchCategories()
    } finally {
      setSaving(null)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile || !uploadTitle.trim()) {
      setUploadError('Title and file are required.')
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('title', uploadTitle.trim())
      fd.append('category', uploadCategory.trim())
      if (uploadDescription.trim()) fd.append('description', uploadDescription.trim())

      const res = await fetch('/api/library', { method: 'POST', credentials: 'include', body: fd })
      if (!res.ok) {
        let detail = 'Upload failed'
        try {
          const err = await res.json()
          detail = err.detail || detail
        } catch {
          detail = await res.text().catch(() => detail)
        }
        throw new Error(detail)
      }
      setShowUpload(false)
      setUploadFile(null)
      setUploadTitle('')
      setUploadCategory('')
      setUploadDescription('')
      fetchDocs()
      fetchCategories()
    } catch (e: any) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const filtered = docs.filter(d => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false
    if (filterCat !== 'all' && d.category !== filterCat) return false
    if (search) {
      const q = search.toLowerCase()
      return d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)
    }
    return true
  })

  // Group by category for display
  const grouped = filtered.reduce<Record<string, LibraryDoc[]>>((acc: Record<string, LibraryDoc[]>, d: LibraryDoc) => {
    if (!acc[d.category]) acc[d.category] = []
    acc[d.category].push(d)
    return acc
  }, {})

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Library className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">TIP Library</h1>
            <p className="text-sm text-gray-500">Reference TIPs for few-shot generation guidance</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUpload(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Add TIP
          </button>
        )}
      </div>

      {/* Upload form (admin) */}
      {isAdmin && showUpload && (
        <form onSubmit={handleUpload} className="mb-6 bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-500" />
            Upload Library TIP
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                placeholder="e.g. M365 Tenant Migration — Contoso"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
                <span className="ml-1 text-xs text-purple-500 font-normal flex-inline items-center gap-0.5">
                  <Sparkles className="w-3 h-3 inline-block" /> AI will suggest if left blank
                </span>
              </label>
              <input
                type="text"
                value={uploadCategory}
                onChange={e => setUploadCategory(e.target.value)}
                placeholder="Leave blank to auto-suggest"
                list="category-suggestions"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="category-suggestions">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={uploadDescription}
              onChange={e => setUploadDescription(e.target.value)}
              placeholder="Brief description of the project or migration type"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">File (.docx or .pdf) *</label>
            <input
              type="file"
              accept=".docx,.pdf"
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required
            />
          </div>
          {uploadError && <p className="text-red-600 text-sm mb-3">{uploadError}</p>}
          {uploading && (
            <p className="text-purple-600 text-xs mb-3 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Extracting text and suggesting category…
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search library…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {isAdmin && (
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading library…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Library className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No library documents found.</p>
          {isAdmin && <p className="text-xs mt-1">Upload a reference TIP to get started.</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{cat}</h2>
                <span className="text-xs text-gray-400">({items.length})</span>
              </div>
              <div className="grid gap-3">
                {items.map(doc => {
                  const st = STATUS_LABELS[doc.status] ?? STATUS_LABELS.pending
                  return (
                    <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                      <FileText className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-medium text-gray-900 text-sm">{doc.title}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.cls}`}>
                            {st.icon}{st.label}
                          </span>
                          {doc.category_suggested && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border text-purple-700 bg-purple-50 border-purple-200">
                              <Sparkles className="w-3 h-3" />AI suggested
                            </span>
                          )}
                        </div>
                        {/* Inline edit for admin — title + category, all statuses */}
                        {isAdmin && editing[doc.id] !== undefined ? (
                          <div className="flex flex-col gap-1 mt-1 mb-1">
                            <input
                              type="text"
                              value={editing[doc.id].title}
                              onChange={e => setEditing(prev => ({ ...prev, [doc.id]: { ...prev[doc.id], title: e.target.value } }))}
                              placeholder="Title"
                              className="border border-blue-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-64"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editing[doc.id].category}
                                onChange={e => setEditing(prev => ({ ...prev, [doc.id]: { ...prev[doc.id], category: e.target.value } }))}
                                placeholder="Category"
                                list="category-suggestions"
                                className="border border-purple-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 w-40"
                              />
                              <button
                                onClick={() => handleSaveDoc(doc.id)}
                                disabled={saving === doc.id}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => cancelEditing(doc.id)}
                                className="p-1 text-gray-400 hover:bg-gray-50 rounded"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          doc.description && (
                            <p className="text-xs text-gray-500 mb-1 truncate">{doc.description}</p>
                          )
                        )}
                        <p className="text-xs text-gray-400">
                          {doc.original_filename} · {formatBytes(doc.file_size)} · uploaded by {doc.uploaded_by_username}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => editing[doc.id] !== undefined ? cancelEditing(doc.id) : startEditing(doc)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            title="Edit title / category"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {doc.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(doc.id)}
                                className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReject(doc.id)}
                                className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {doc.status === 'rejected' && (
                            <button
                              onClick={() => handleApprove(doc.id)}
                              className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
