import HelpTopicLayout from '../../components/HelpTopicLayout'
import { Link } from 'react-router-dom'

export default function GettingStartedPage() {
  return (
    <HelpTopicLayout
      icon="🚀"
      title="Getting Started"
      subtitle="How to create your first Technical Implementation Plan"
      sections={[
        {
          title: 'What is TIP Generator?',
          content: (
            <>
              <p>TIP Generator uses Claude AI to automatically create Technical Implementation Plans (TIPs) from your existing discovery worksheets and service orders.</p>
              <p className="mt-2">Instead of writing a TIP from scratch, you upload your Excel discovery workbook and PDF service order, select a Word template, and let the AI draft the full document in 2–4 minutes.</p>
            </>
          ),
        },
        {
          title: 'Quick Start — Your First TIP',
          content: (
            <ol className="list-decimal ml-4 space-y-2">
              <li><strong>Upload your template</strong> — Go to <Link to="/admin/template" className="text-blue-600 underline">Template</Link> and upload your TIP Word document (.docx). This becomes the structural guide for all future generations.</li>
              <li><strong>Upload your documents</strong> — Go to <Link to="/upload" className="text-blue-600 underline">Upload</Link> and add your discovery worksheet (.xlsx) and/or service order (.pdf).</li>
              <li><strong>Generate</strong> — Go to <Link to="/generate" className="text-blue-600 underline">Generate</Link>, enter a title, select your documents, and click <em>Generate TIP</em>.</li>
              <li><strong>Review your draft</strong> — When generation completes, you'll land automatically on your new draft. Review, then export to Word.</li>
            </ol>
          ),
        },
        {
          title: 'Typical Workflow',
          content: (
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="font-bold text-blue-600 w-5 flex-shrink-0">1</span>
                <div><strong>Receive project docs</strong> — discovery worksheet and service order from the client engagement team.</div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="font-bold text-blue-600 w-5 flex-shrink-0">2</span>
                <div><strong>Upload to TIP Generator</strong> — add them on the Upload page.</div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="font-bold text-blue-600 w-5 flex-shrink-0">3</span>
                <div><strong>Run generation</strong> — name the TIP (e.g. "ClientName — Cloud Migration"), select your documents, click Generate.</div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="font-bold text-blue-600 w-5 flex-shrink-0">4</span>
                <div><strong>Review and refine</strong> — read the draft, look for <code>[DATA NEEDED: ...]</code> placeholders, and fill them in before delivery.</div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="font-bold text-blue-600 w-5 flex-shrink-0">5</span>
                <div><strong>Export</strong> — download the finished .docx for final client delivery.</div>
              </div>
            </div>
          ),
        },
        {
          title: 'Things to Know',
          content: (
            <ul className="list-disc ml-4 space-y-1.5">
              <li>Generation takes <strong>2–4 minutes</strong> for a full discovery workbook. Stay on the Generate page to watch progress.</li>
              <li>The AI will insert <code>[DATA NEEDED: ...]</code> markers wherever your source documents were missing information. These require manual review before delivery.</li>
              <li>You can run multiple TIPs from the same uploaded documents.</li>
              <li>Templates only need to be uploaded once and stay active until you replace them.</li>
            </ul>
          ),
        },
      ]}
    />
  )
}
