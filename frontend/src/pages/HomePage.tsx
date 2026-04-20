import { Link } from 'react-router-dom'
import { FileText, Upload, Sparkles } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="text-center">
      <div className="mb-8">
        <FileText className="h-20 w-20 text-blue-600 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to TIP Generator
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          AI-powered Technical Implementation Plan generator using Claude Sonnet 4.6
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <Upload className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">1. Upload Documents</h3>
          <p className="text-gray-600 mb-4">
            Upload discovery worksheets (Excel) and service orders (PDF)
          </p>
          <Link
            to="/upload"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Upload Now
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <Sparkles className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">2. Generate TIP</h3>
          <p className="text-gray-600 mb-4">
            AI analyzes your documents and creates a comprehensive TIP
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <FileText className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">3. Review & Export</h3>
          <p className="text-gray-600 mb-4">
            Review, edit, and export your TIP as Word or PDF
          </p>
        </div>
      </div>

      <div className="mt-12 bg-blue-50 p-6 rounded-lg max-w-2xl mx-auto">
        <h3 className="text-lg font-semibold mb-2">Powered by Claude Sonnet 4.6</h3>
        <p className="text-gray-700">
          Latest AI model with superior technical writing and structured output capabilities
        </p>
      </div>
    </div>
  )
}
