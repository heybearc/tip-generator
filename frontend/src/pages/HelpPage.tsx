import { Link } from 'react-router-dom'
import { Upload, Wand2, FolderOpen, Settings, FileText, HelpCircle, Rocket, BookOpen } from 'lucide-react'

const topics = [
  {
    id: 'getting-started',
    icon: Rocket,
    title: 'Getting Started',
    description: 'Overview of TIP Generator and how to create your first TIP from scratch.',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    id: 'upload-documents',
    icon: Upload,
    title: 'Uploading Documents',
    description: 'How to upload discovery worksheets (Excel), service orders (PDF), and Word templates.',
    color: 'text-green-600 bg-green-50',
  },
  {
    id: 'generate-tip',
    icon: Wand2,
    title: 'Generating a TIP',
    description: 'How to run a generation, understand progress batches, and what to do when it completes.',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    id: 'manage-drafts',
    icon: FolderOpen,
    title: 'Managing Drafts',
    description: 'Viewing, exporting, and understanding the status of your generated TIP drafts.',
    color: 'text-orange-600 bg-orange-50',
  },
  {
    id: 'template-management',
    icon: Settings,
    title: 'Template Management',
    description: 'Uploading and activating a Word template that defines the structure of your TIPs.',
    color: 'text-gray-600 bg-gray-100',
  },
  {
    id: 'release-notes',
    icon: BookOpen,
    title: 'Release Notes',
    description: 'See what\'s new in each version of TIP Generator.',
    color: 'text-indigo-600 bg-indigo-50',
    external: '/release-notes',
  },
]

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-start gap-3">
        <HelpCircle className="w-8 h-8 text-blue-600 mt-1 flex-shrink-0" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Help Center</h1>
          <p className="text-gray-500 mt-1">Everything you need to know about using TIP Generator</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topics.map(topic => {
          const Icon = topic.icon
          const href = topic.external || `/help/${topic.id}`
          return (
            <Link
              key={topic.id}
              to={href}
              className="bg-white rounded-xl border shadow-sm p-5 flex items-start gap-4 hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className={`p-2.5 rounded-lg ${topic.color} flex-shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{topic.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{topic.description}</p>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex items-start gap-4">
        <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-blue-900">Need more help?</p>
          <p className="text-sm text-blue-700 mt-0.5">Contact your system administrator or check the <Link to="/release-notes" className="underline">release notes</Link> for the latest changes.</p>
        </div>
      </div>
    </div>
  )
}
