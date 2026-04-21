import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Wand2, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const error = params.get('error')

  useEffect(() => {
    if (!loading && user) navigate('/')
  }, [user, loading, navigate])

  const handleLogin = () => {
    window.location.href = '/api/auth/login'
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Wand2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TIP Generator</h1>
          <p className="text-gray-500 mt-2 text-sm">Sign in with your Thrive account to continue</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error === 'state_mismatch' ? 'Login session expired. Please try again.' :
             error === 'token_exchange_failed' ? 'Authentication failed. Please try again.' :
             error === 'userinfo_failed' ? 'Could not retrieve user info. Please try again.' :
             `Login error: ${error}`}
          </div>
        )}

        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm"
        >
          Sign in with Authentik
        </button>

        <p className="text-center text-xs text-gray-400">
          Access is restricted to authorized Thrive team members.
        </p>
      </div>
    </div>
  )
}
