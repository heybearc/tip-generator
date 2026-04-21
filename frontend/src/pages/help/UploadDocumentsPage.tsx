import HelpTopicLayout from '../../components/HelpTopicLayout'

export default function UploadDocumentsPage() {
  return (
    <HelpTopicLayout
      icon="📁"
      title="Uploading Documents"
      subtitle="How to upload discovery worksheets, service orders, and templates"
      sections={[
        {
          title: 'Supported File Types',
          content: (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { ext: '.xlsx', label: 'Discovery Worksheet', desc: 'Excel workbook from the client discovery session. Contains environment inventory, VM specs, IP/VLAN tables.' },
                { ext: '.pdf', label: 'Service Order', desc: 'PDF contract or service order describing the engagement scope and deliverables.' },
                { ext: '.docx', label: 'TIP Template', desc: 'Word document defining the TIP structure. Upload this on the Template page, not here.' },
              ].map(f => (
                <div key={f.ext} className="p-3 bg-gray-50 rounded-lg border">
                  <p className="font-mono font-bold text-blue-700 text-sm">{f.ext}</p>
                  <p className="font-medium text-gray-800 text-sm mt-1">{f.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
                </div>
              ))}
            </div>
          ),
        },
        {
          title: 'How to Upload',
          content: (
            <ol className="list-decimal ml-4 space-y-2">
              <li>Go to the <strong>Upload</strong> page from the navigation bar.</li>
              <li>Drag and drop your files onto the upload zone, or click <strong>Browse Files</strong> to select them.</li>
              <li>You can upload multiple files at once — each will be processed separately.</li>
              <li>Wait for the status to show <strong>processed</strong> (green). This usually takes a few seconds.</li>
              <li>Processed documents are now available to select when generating a TIP.</li>
            </ol>
          ),
        },
        {
          title: 'File Size Limit',
          content: <p>Maximum file size is <strong>10MB per file</strong>. If your discovery workbook exceeds this, try removing any embedded images or charts before uploading.</p>,
        },
        {
          title: 'Document Status',
          content: (
            <div className="space-y-2">
              {[
                { status: 'processing', color: 'bg-yellow-100 text-yellow-800', desc: 'File is being parsed and indexed.' },
                { status: 'processed', color: 'bg-green-100 text-green-800', desc: 'Ready to use in generation.' },
                { status: 'failed', color: 'bg-red-100 text-red-800', desc: 'File could not be parsed. Check the format and re-upload.' },
              ].map(s => (
                <div key={s.status} className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.status}</span>
                  <span className="text-sm text-gray-600">{s.desc}</span>
                </div>
              ))}
            </div>
          ),
        },
        {
          title: 'Frequently Asked Questions',
          content: (
            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-800">Can I upload the same file twice?</p>
                <p className="text-gray-600 mt-0.5">Yes. Each upload creates a new document entry. Use the Documents page to delete old versions.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800">Why is my Excel file failing to parse?</p>
                <p className="text-gray-600 mt-0.5">The parser reads data cells only. Merged cells, password protection, and macro-enabled formats (.xlsm) may cause failures. Save as plain .xlsx first.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800">Where do I upload the TIP Word template?</p>
                <p className="text-gray-600 mt-0.5">Templates are uploaded on the <strong>Template</strong> page (Settings icon in nav), not here.</p>
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}
