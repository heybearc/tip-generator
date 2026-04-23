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
          title: 'Managing Sections (Order & Visibility)',
          content: (
            <>
              <p>Before exporting, you can control which sections appear in the final document and in what order.</p>
              <ol className="list-decimal ml-4 space-y-2 mt-3">
                <li>Open a completed draft and click <strong>Manage Sections</strong> near the top of the page.</li>
                <li>Toggle sections <strong>on or off</strong> — hidden sections are excluded from the export.</li>
                <li>Drag sections up or down to <strong>reorder</strong> them.</li>
                <li>Click <strong>Save Order</strong> to apply. Your changes are saved to this draft permanently.</li>
              </ol>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                <strong>Tip:</strong> Use this to remove auto-generated cover sections (like "Technical Implementation Plan") or to move the Executive Summary to the top before delivering to a client.
              </div>
            </>
          ),
        },
        {
          title: 'Refining Sections',
          content: (
            <>
              <p>You can improve the writing in your draft using two refine tools:</p>
              <ul className="list-disc ml-4 space-y-2 mt-2">
                <li><strong>Per-section Refine</strong> — click <strong>Refine</strong> on any expanded section to tighten the text, apply the template style, or write a custom instruction. You'll see a before/after preview before applying.</li>
                <li><strong>Whole-Document Refine</strong> — applies an instruction (e.g. "tighten all sections by 30%") to every section at once. Results appear as a preview you can accept or discard per section.</li>
              </ul>
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800">
                <strong>Note:</strong> Whole-Document Refine sends multiple requests to Claude and may take a minute to complete for large drafts.
              </div>
            </>
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
