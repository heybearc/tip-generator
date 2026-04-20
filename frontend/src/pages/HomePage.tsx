import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { FileText, Upload, Wand2, FolderOpen, Files, ArrowRight } from 'lucide-react'

const API_URL = '/api'

export default function HomePage() {
  const [docCount, setDocCount] = useState<number | null>(null)
  const [draftCount, setDraftCount] = useState<number | null>(null)
  const [templateName, setTemplateName] = useState<string | null>(null)

  useEffect(() => {
    axios.get(`${API_URL}/documents`).then(r => setDocCount(r.data.length)).catch(() => {})
    axios.get(`${API_URL}/generate/drafts`).then(r => setDraftCount(r.data.length)).catch(() => {})
    axios.get(`${API_URL}/templates/current`).then(r => setTemplateName(r.data.filename)).catch(() => {})
  }, [])

  const cards = [
    {
      step: '1',
      icon: <Upload className="h-10 w-10 text-blue-600" />,
      title: 'Upload Documents',
      description: 'Upload discovery worksheets (Excel) and service orders (PDF)',
      action: 'Upload Now',
      to: '/upload',
      stat: docCount !== null ? `${docCount} document${docCount !== 1 ? 's' : ''} uploaded` : null,
      color: 'blue',
    },
    {
      step: '2',
      icon: <Wand2 className="h-10 w-10 text-purple-600" />,
      title: 'Generate TIP',
      description: 'AI analyzes your documents and creates a comprehensive TIP',
      action: 'Generate Now',
      to: '/generate',
      stat: templateName ? `Template: ${templateName}` : 'No template set',
      color: 'purple',
    },
    {
      step: '3',
      icon: <FolderOpen className="h-10 w-10 text-green-600" />,
      title: 'Review & Edit',
      description: 'Review, edit with AI assistance, and export your TIP',
      action: 'View Drafts',
      to: '/drafts',
      stat: draftCount !== null ? `${draftCount} draft${draftCount !== 1 ? 's' : ''} saved` : null,
      color: 'green',
    },
  ]

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    green: 'bg-green-600 hover:bg-green-700',
  }

  return (
    <div className="text-center max-w-5xl mx-auto">
      <div className="mb-10">
        <FileText className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome to TIP Generator</h1>
        <p className="text-lg text-gray-500">AI-powered Technical Implementation Plans using Claude Sonnet 4.6</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-8">
        {cards.map(card => (
          <div key={card.step} className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md hover:border-gray-300 transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-sm font-bold flex items-center justify-center">{card.step}</span>
              {card.icon}
            </div>
            <h3 className="text-lg font-semibold text-left mb-2">{card.title}</h3>
            <p className="text-gray-500 text-sm text-left mb-4 flex-1">{card.description}</p>
            {card.stat && (
              <div className="text-xs text-gray-400 text-left mb-4 bg-gray-50 rounded px-3 py-1.5 truncate">
                {card.stat}
              </div>
            )}
            <Link
              to={card.to}
              className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg text-white text-sm font-medium transition-colors ${colorMap[card.color]}`}
            >
              {card.action} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 p-5 rounded-xl max-w-2xl mx-auto">
        <p className="text-sm font-medium text-gray-700">Powered by <span className="text-blue-600 font-semibold">Claude Sonnet 4.6</span> — latest AI model with superior technical writing capabilities</p>
      </div>
    </div>
  )
}
