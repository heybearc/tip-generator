import { useEffect, useState } from 'react'
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, Save, Trash2, RefreshCw, Cpu } from 'lucide-react'
import axios from 'axios'

interface Profile {
  id: number
  email: string
  username: string
  full_name: string | null
  has_claude_api_key: boolean
  claude_model: string | null
}

interface Model {
  id: string
  display_name: string
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [models, setModels] = useState<Model[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('')

  useEffect(() => {
    axios.get('/api/auth/profile', { withCredentials: true })
      .then(r => {
        setProfile(r.data)
        setSelectedModel(r.data.claude_model || '')
        if (r.data.has_claude_api_key) fetchModels()
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load profile.' }))
  }, [])

  const fetchModels = async () => {
    setLoadingModels(true)
    try {
      const r = await axios.get('/api/auth/profile/models', { withCredentials: true })
      setModels(r.data.models)
    } catch {
      setModels([])
    } finally {
      setLoadingModels(false)
    }
  }

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      const r = await axios.patch('/api/auth/profile', { claude_api_key: apiKey.trim() }, { withCredentials: true })
      setProfile(r.data)
      setApiKey('')
      setMessage({ type: 'success', text: 'API key saved.' })
      fetchModels()
    } catch {
      setMessage({ type: 'error', text: 'Failed to save API key.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveModel = async (modelId: string) => {
    setSelectedModel(modelId)
    try {
      const r = await axios.patch('/api/auth/profile', { claude_model: modelId }, { withCredentials: true })
      setProfile(r.data)
      setMessage({ type: 'success', text: `Model set to ${modelId}.` })
    } catch {
      setMessage({ type: 'error', text: 'Failed to save model.' })
    }
  }

  const handleRemove = async () => {
    if (!confirm('Remove your Claude API key? Generation will be disabled until you add one.')) return
    setSaving(true)
    setMessage(null)
    try {
      const r = await axios.patch('/api/auth/profile', { claude_api_key: '' }, { withCredentials: true })
      setProfile(r.data)
      setApiKey('')
      setMessage({ type: 'success', text: 'API key removed.' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove API key.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>

      {profile && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-2">
          <div className="text-sm text-gray-500">Signed in as</div>
          <div className="font-medium text-gray-900">{profile.full_name || profile.username}</div>
          <div className="text-sm text-gray-500">{profile.email}</div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Claude API Key</h2>
        </div>

        <p className="text-sm text-gray-600">
          Required for TIP generation and AI Assist. Get your key from{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">
            console.anthropic.com
          </a>.
        </p>

        {profile?.has_claude_api_key ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-md">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-sm text-green-800 flex-1">API key is set. Generation is enabled.</span>
            <button
              onClick={handleRemove}
              disabled={saving}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800">No API key set. Add one below to enable generation.</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {profile?.has_claude_api_key ? 'Replace API key' : 'Add API key'}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={handleSaveKey}
              disabled={saving || !apiKey.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`flex items-center gap-2 text-sm p-3 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            {message.text}
          </div>
        )}
      </div>

      {profile?.has_claude_api_key && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Claude Model</h2>
            </div>
            <button
              onClick={fetchModels}
              disabled={loadingModels}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingModels ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <p className="text-sm text-gray-600">Select the model used for TIP generation and AI Assist.</p>
          {models.length > 0 ? (
            <div className="space-y-2">
              {models.map(m => (
                <label key={m.id} className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  selectedModel === m.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="radio"
                    name="claude_model"
                    value={m.id}
                    checked={selectedModel === m.id}
                    onChange={() => handleSaveModel(m.id)}
                    className="text-blue-600"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{m.display_name}</div>
                    <div className="text-xs text-gray-500">{m.id}</div>
                  </div>
                </label>
              ))}
            </div>
          ) : loadingModels ? (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading models…
            </div>
          ) : (
            <div className="text-sm text-gray-500">No models loaded. Click Refresh to fetch from Anthropic.</div>
          )}
          {!selectedModel && models.length > 0 && (
            <p className="text-xs text-amber-600">No model selected — generation will use the server default (claude-sonnet-4-5).</p>
          )}
        </div>
      )}
    </div>
  )
}
