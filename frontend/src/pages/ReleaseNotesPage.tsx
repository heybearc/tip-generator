import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { ChevronDown, ChevronUp, Search, Tag } from 'lucide-react'

const API_URL = '/api'

interface Release {
  version: string
  date: string
  type: string
  title: string
  description: string
  content: string
}

function typeColor(type: string) {
  switch (type) {
    case 'major': return 'bg-red-100 text-red-800 border border-red-200'
    case 'minor': return 'bg-blue-100 text-blue-800 border border-blue-200'
    default:      return 'bg-green-100 text-green-800 border border-green-200'
  }
}

function typeIcon(type: string) {
  switch (type) {
    case 'major': return '🚀'
    case 'minor': return '✨'
    default:      return '🔧'
  }
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^# .+$/m, '')
    .replace(/\*\*Released:\*\*.+/g, '')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-gray-800 mt-5 mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-700 mt-4 mb-1">$1</h3>')
    .replace(/^\*\*(.+)\*\*$/gm, '<p class="font-semibold text-gray-700">$1</p>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-600 text-sm">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-600 text-sm">$2</li>')
    .replace(/(<li.*<\/li>\n)+/g, '<ul class="my-2 space-y-1">$&</ul>')
    .replace(/^(?!<[hlu]).+$/gm, (line) => line.trim() ? `<p class="text-gray-600 text-sm mb-1">${line}</p>` : '')
    .replace(/\n{2,}/g, '')
}

export default function ReleaseNotesPage() {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    axios.get(`${API_URL}/release-notes`).then(r => {
      setReleases(r.data)
      if (r.data.length > 0) setExpanded(new Set([r.data[0].version]))
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => releases.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || r.version.includes(q) || r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
    const matchType = typeFilter === 'all' || r.type === typeFilter
    return matchSearch && matchType
  }), [releases, search, typeFilter])

  const toggle = (version: string) => {
    const next = new Set(expanded)
    next.has(version) ? next.delete(version) : next.add(version)
    setExpanded(next)
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Release Notes</h1>
        <p className="text-gray-500 mt-1">What's new in TIP Generator</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search release notes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 items-center">
          <Tag className="w-4 h-4 text-gray-400" />
          {['all', 'major', 'minor', 'patch'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                typeFilter === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">No releases match your search.</div>
      )}

      <div className="space-y-3">
        {filtered.map(release => (
          <div key={release.version} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <button
              onClick={() => toggle(release.version)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{typeIcon(release.type)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">v{release.version}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${typeColor(release.type)}`}>
                      {release.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{release.title}{release.date ? ` · ${release.date}` : ''}</p>
                </div>
              </div>
              {expanded.has(release.version)
                ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
              }
            </button>
            {expanded.has(release.version) && (
              <div
                className="px-6 pb-6 pt-2 border-t border-gray-100 prose-sm"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(release.content) }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
