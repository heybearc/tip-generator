import HelpTopicLayout from '../../components/HelpTopicLayout'
import { Link } from 'react-router-dom'

export default function ManageDraftsPage() {
  return (
    <HelpTopicLayout
      icon="📂"
      title="Managing Drafts"
      subtitle="Viewing, understanding, and exporting your generated TIP drafts"
      sections={[
        {
          title: 'What is a Draft?',
          content: (
            <p>Every time you run a generation, TIP Generator creates a <strong>draft</strong> — a saved version of the AI-generated TIP content. Drafts are stored permanently so you can return to them, compare versions, or export at any time.</p>
          ),
        },
        {
          title: 'Draft Statuses',
          content: (
            <div className="space-y-2">
              {[
                { status: 'generating', color: 'bg-blue-100 text-blue-800', desc: 'Generation is in progress. The Generate page will show live progress.' },
                { status: 'completed', color: 'bg-green-100 text-green-800', desc: 'Generation finished successfully. Ready to view and export.' },
                { status: 'failed', color: 'bg-red-100 text-red-800', desc: 'Generation encountered an error. The draft may have partial content.' },
              ].map(s => (
                <div key={s.status} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 ${s.color}`}>{s.status}</span>
                  <span className="text-sm text-gray-600">{s.desc}</span>
                </div>
              ))}
            </div>
          ),
        },
        {
          title: 'Viewing a Draft',
          content: (
            <ol className="list-decimal ml-4 space-y-2">
              <li>Go to <Link to="/drafts" className="text-blue-600 underline">Drafts</Link> in the navigation bar.</li>
              <li>Click any draft card to open the full draft view.</li>
              <li>The draft is displayed section-by-section as it was generated. Scroll to review all content.</li>
              <li>Look for <code className="bg-gray-100 px-1 rounded text-xs">[DATA NEEDED: ...]</code> markers — these indicate places where the source documents lacked information. Fill these in before delivery.</li>
            </ol>
          ),
        },
        {
          title: 'Exporting to Word',
          content: (
            <>
              <p>Click <strong>Export to Word (.docx)</strong> on any completed draft to download a properly formatted Word document using your active TIP template's branding.</p>
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800">
                <strong>Before delivering to clients:</strong> open the exported .docx in Word, search for <code>[DATA NEEDED</code>, and replace all placeholders with accurate project-specific information.
              </div>
            </>
          ),
        },
        {
          title: 'Token Count',
          content: <p>Each draft shows its <strong>token count</strong> — the total number of Claude API tokens used to generate it. This gives you a rough indication of document complexity and API cost. A typical full TIP uses 100,000–150,000 tokens.</p>,
        },
        {
          title: 'Frequently Asked Questions',
          content: (
            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-800">Can I delete a draft?</p>
                <p className="text-gray-600 mt-0.5">Draft deletion is on the roadmap but not yet available. For now, drafts accumulate and can be browsed by date.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800">Can I re-generate a draft?</p>
                <p className="text-gray-600 mt-0.5">Yes — go to Generate and create a new draft with the same title and documents. The old draft will remain available for comparison.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800">What if the export looks wrong in Word?</p>
                <p className="text-gray-600 mt-0.5">Make sure your TIP template is a clean .docx with standard Thrive/company formatting. The exporter uses your template's styles and headers directly.</p>
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}
