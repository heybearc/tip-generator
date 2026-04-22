import { useEffect, useState } from 'react'
import { Users, ShieldCheck, KeyRound, Activity, ToggleLeft, ToggleRight, Loader2, AlertCircle, BarChart3 } from 'lucide-react'
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

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      axios.get('/api/admin/users', { withCredentials: true }),
      axios.get('/api/admin/stats', { withCredentials: true }),
    ])
      .then(([u, s]) => {
        setUsers(u.data)
        setStats(s.data)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-blue-600" />
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

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Users</h2>
        </div>
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
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        User
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {u.has_api_key ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <KeyRound className="w-3 h-3" /> Set
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-500 font-mono">
                      {u.claude_model ? u.claude_model.split('-').slice(0, 3).join('-') : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-700">{u.draft_count}</td>
                  <td className="px-6 py-4 text-right text-gray-700">{formatTokens(u.total_tokens)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={toggling === u.id}
                        title={u.is_active ? 'Deactivate user' : 'Activate user'}
                        className="text-gray-400 hover:text-blue-600 disabled:opacity-40 transition-colors"
                      >
                        {toggling === u.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : u.is_active
                            ? <ToggleRight className="w-5 h-5 text-green-500" />
                            : <ToggleLeft className="w-5 h-5" />
                        }
                      </button>
                      <button
                        onClick={() => toggleAdmin(u)}
                        disabled={toggling === u.id}
                        title={u.is_superuser ? 'Remove admin' : 'Make admin'}
                        className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 ${
                          u.is_superuser
                            ? 'border-purple-300 text-purple-600 hover:bg-purple-50'
                            : 'border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
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
    </div>
  )
}
