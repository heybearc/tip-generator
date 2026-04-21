import HelpTopicLayout from '../../components/HelpTopicLayout'
import { Link } from 'react-router-dom'

export default function TemplateManagementHelpPage() {
  return (
    <HelpTopicLayout
      icon="⚙️"
      title="Template Management"
      subtitle="Uploading and managing the Word template that structures your TIPs"
      sections={[
        {
          title: 'What is a TIP Template?',
          content: (
            <p>The TIP template is a Word document (.docx) that defines the <strong>structure and branding</strong> of every generated TIP. It contains your company's header/footer, section headings, table styles, and fonts. The AI uses it as both a structural guide and a formatting source when exporting.</p>
          ),
        },
        {
          title: 'Uploading a Template',
          content: (
            <ol className="list-decimal ml-4 space-y-2">
              <li>Go to <Link to="/admin/template" className="text-blue-600 underline">Template</Link> via the Settings icon in the navigation bar.</li>
              <li>Click <strong>Upload Template</strong> and select your .docx file.</li>
              <li>The template is parsed and activated immediately. All future generations will use this template.</li>
            </ol>
          ),
        },
        {
          title: 'Template Requirements',
          content: (
            <ul className="list-disc ml-4 space-y-1.5">
              <li>Format: <strong>.docx only</strong> (Word 2007+). No .doc or .odt.</li>
              <li>Max file size: <strong>10MB</strong>.</li>
              <li>The document should contain the standard TIP section headings in order. The AI reads these headings to determine what content to generate for each section.</li>
              <li>Header and footer in your template are automatically applied to every exported TIP.</li>
              <li>Table styles and font choices from your template are preserved in the export.</li>
            </ul>
          ),
        },
        {
          title: 'Active Template',
          content: (
            <>
              <p>Only one template is active at a time. When you upload a new template, it becomes the active template immediately.</p>
              <p className="mt-2">The Template page shows the currently active template's filename, upload date, and a preview of the sections it contains.</p>
            </>
          ),
        },
        {
          title: 'Frequently Asked Questions',
          content: (
            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-800">What happens if I upload a new template while a generation is running?</p>
                <p className="text-gray-600 mt-0.5">In-progress generations use the template that was active when they started. The new template takes effect for subsequent generations.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800">Do I need to re-upload the template for every project?</p>
                <p className="text-gray-600 mt-0.5">No. Once uploaded, the template stays active indefinitely until you upload a replacement.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800">My exported TIP has different fonts than the template. Why?</p>
                <p className="text-gray-600 mt-0.5">The exporter applies your template's body style. If the template uses embedded custom fonts, make sure those fonts are also installed on the server. Contact your administrator if the issue persists.</p>
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}
