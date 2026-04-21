import { Link } from 'react-router-dom'
import { ArrowLeft, HelpCircle } from 'lucide-react'

interface Section {
  title: string
  content: React.ReactNode
}

interface HelpTopicLayoutProps {
  icon: string
  title: string
  subtitle: string
  sections: Section[]
}

export default function HelpTopicLayout({ icon, title, subtitle, sections }: HelpTopicLayoutProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/help" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Help Center
        </Link>
        <span>/</span>
        <span className="text-gray-900">{title}</span>
      </div>

      <div className="flex items-start gap-4">
        <span className="text-4xl">{icon}</span>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-500 mt-1">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section, i) => (
          <div key={i} className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{section.title}</h2>
            <div className="text-sm text-gray-600 space-y-2 leading-relaxed">
              {section.content}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 border rounded-xl p-4 flex items-center gap-3 text-sm text-gray-500">
        <HelpCircle className="w-4 h-4 flex-shrink-0" />
        <span>Still have questions? Contact your system administrator.</span>
      </div>
    </div>
  )
}
