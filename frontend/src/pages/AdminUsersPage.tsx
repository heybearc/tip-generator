import { useEffect, useState } from 'react'
import { Users, ShieldCheck, KeyRound, Activity, ToggleLeft, ToggleRight, Loader2, AlertCircle, BarChart3, Files, FolderOpen } from 'lucide-react'
import axios from 'axios'

interface AdminUser {
  id: number
  email: string
  username: string
  full_name: string | null
  is_active: boolean
  is_superuser: boolean
  has_api_key: boolean
  claude_model: string | null
  draft_count: number
  total_tokens: number
  created_at: string
}

interface AdminStats {
  total_users: number
  active_users: number
  total_drafts: number
  total_tokens: number
  users_with_api_key: number
}

interface AdminDocument {
  id: number
  owner_email: string
  owner_username: string
  filename: string
  original_filename: string
  document_type: string
  status: string
  file_size: number | null
  created_at: string
}

interface AdminDraft {
  id: number
  owner_email: string
  owner_username: string
  title: string
  status: string
  claude_model: string | null
  generation_tokens: number | null
  created_at: string
  generated_at: string | null
}

type Tab = 'users' | 'documents' | 'drafts'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export default function AdminUsersPage() {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [documents, setDocuments] = useState<AdminDocument[]>([])
  const [drafts, setDrafts] = useState<AdminDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      axios.get('/api/admin/users', { withCredentials: true }),
      axios.get('/api/admin/stats', { withCredentials: true }),
      axios.get('/api/admin/documents', { withCredentials: true }),
      axios.get('/api/admin/drafts', { withCredentials: true }),
    ])
      .then(([u, s, d, dr]) => {
        setUsers(u.data)
        setStats(s.data)
        setDocuments(d.data)
        setDrafts(dr.data)
      })
      .catch(() => setError('Failed to load admin data.'))
      .finally(() => setLoading(false))
  }, [])

  const toggleActive = async (user: AdminUser) => {
    setToggling(user.id)
    try {
      const r = await axios.patch(
        `/api/admin/users/${user.id}`,
        { is_active: !user.is_active },
        { withCredentials: true }
      )
      setUsers(prev => prev.map(u => u.id === user.id ? r.data : u))
    } catch {
      setError('Failed to update user.')
    } finally {
      setToggling(null)
    }
  }

  const toggleAdmin = async (user: AdminUser) => {
    if (!confirm(`${user.is_superuser ? 'Remove admin from' : 'Make admin'}: ${user.email}?`)) return
    setToggling(user.id)
    try {
      const r = await axios.patch(
        `/api/admin/users/${user.id}`,
        { is_superuser: !user.is_superuser },
        { withCredentials: true }
      )
      setUsers(prev => prev.map(u => u.id === user.id ? r.data : u))
    } catch {
      setError('Failed to update user.')
    } finally {
      setToggling(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
    </div>
  )

  if (error) return (
    <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {error}
    </div>
  )

  const tabs: { id: Tab; label: string; icon: typeof Users; count: number }[] = [
    { id: 'users', label: 'Users', icon: Users, count: users.length },
    { id: 'documents', label: 'Documents', icon: Files, count: documents.length },
    { id: 'drafts', label: 'Drafts', icon: FolderOpen, count: drafts.length },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-purple-600" />
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { icon: Users, label: 'Total Users', value: stats.total_users },
            { icon: Activity, label: 'Active', value: stats.active_users },
            { icon: KeyRound, label: 'API Keys Set', value: stats.users_with_api_key },
            { icon: BarChart3, label: 'Total Drafts', value: stats.total_drafts },
            { icon: BarChart3, label: 'Total Tokens', value: formatTokens(stats.total_tokens) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">User</th>
                  <th className="px-6 py-3 text-left">Role</th>
                  <th className="px-6 py-3 text-left">API Key</th>
                  <th className="px-6 py-3 text-left">Model</th>
                  <th className="px-6 py-3 text-right">Drafts</th>
                  <th className="px-6 py-3 text-right">Tokens</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{u.full_name || u.username}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {u.is_superuser ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          <ShieldCheck className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">User</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.has_api_key
                        ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><KeyRound className="w-3 h-3" /> Set</span>
                        : <span className="text-xs text-amber-600">Not set</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-500 font-mono">{u.claude_model || '—'}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700">{u.draft_count}</td>
                    <td className="px-6 py-4 text-right text-gray-700">{formatTokens(u.total_tokens)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleActive(u)} disabled={toggling === u.id}
                          title={u.is_active ? 'Deactivate' : 'Activate'}
                          className="text-gray-400 hover:text-blue-600 disabled:opacity-40 transition-colors">
                          {toggling === u.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : u.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                        <button onClick={() => toggleAdmin(u)} disabled={toggling === u.id}
                          className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                            u.is_superuser
                              ? 'border-purple-300 text-purple-600 hover:bg-purple-50'
                              : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}>
                          {u.is_superuser ? 'Revoke admin' : 'Make admin'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents tab */}
      {tab === 'documents' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">File</th>
                  <th className="px-6 py-3 text-left">Owner</th>
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-right">Size</th>
                  <th className="px-6 py-3 text-left">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No documents uploaded</td></tr>
                )}
                {documents.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{d.original_filename}</div>
                      <div className="text-xs text-gray-400 font-mono">{d.filename}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700">{d.owner_username}</div>
                      <div className="text-xs text-gray-400">{d.owner_email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{d.document_type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        d.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500 text-xs">
                      {d.file_size ? `${(d.file_size / 1024).toFixed(0)} KB` : '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drafts tab */}
      {tab === 'drafts' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">Title</th>
                  <th className="px-6 py-3 text-left">Owner</th>
                  <th className="px-6 py-3 text-left">Status</th>
                  <th className="px-6 py-3 text-left">Model</th>
                  <th className="px-6 py-3 text-right">Tokens</th>
                  <th className="px-6 py-3 text-left">Created</th>
                  <th className="px-6 py-3 text-left">Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drafts.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No drafts yet</td></tr>
                )}
                {drafts.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900 truncate max-w-xs">{d.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-700">{d.owner_username}</div>
                      <div className="text-xs text-gray-400">{d.owner_email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        d.status === 'completed' ? 'bg-green-100 text-green-700'
                        : d.status === 'generating' ? 'bg-yellow-100 text-yellow-700'
                        : d.status === 'failed' ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-gray-500">{d.claude_model || '—'}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700">{d.generation_tokens ? formatTokens(d.generation_tokens) : '—'}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{d.generated_at ? new Date(d.generated_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
