import HelpTopicLayout from '../../components/HelpTopicLayout'

export default function GenerateTipPage() {
  return (
    <HelpTopicLayout
      icon="🪄"
      title="Generating a TIP"
      subtitle="How to run generation, track progress, and what to expect"
      sections={[
        {
          title: 'Before You Generate',
          content: (
            <ul className="list-disc ml-4 space-y-1.5">
              <li>At least one document must be uploaded and in <strong>processed</strong> status.</li>
              <li>A TIP template must be active (check the Template page).</li>
              <li>Have a clear project title ready — this becomes the TIP document title.</li>
            </ul>
          ),
        },
        {
          title: 'Running a Generation',
          content: (
            <ol className="list-decimal ml-4 space-y-2">
              <li>Go to <strong>Generate</strong> in the navigation bar.</li>
              <li>Enter a descriptive <strong>TIP title</strong> (e.g. "ClientName — Cloud Migration v1.0").</li>
              <li>Optionally add a description with any special context for the AI.</li>
              <li>Select a <strong>Discovery Document</strong> (your Excel workbook) from the dropdown.</li>
              <li>Optionally select a <strong>Service Order</strong> (PDF).</li>
              <li>Click <strong>Generate TIP</strong>.</li>
            </ol>
          ),
        },
        {
          title: 'Understanding the Progress Panel',
          content: (
            <>
              <p>Once generation starts, a progress panel appears below the form. You do not need to navigate away.</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <span className="text-blue-600 font-mono text-xs pt-0.5">Batch 1 of 13</span>
                  <p className="text-sm">The AI works in <strong>batches</strong> — each batch is one Claude API call covering ~5 template sections. "Batch 3 of 13" means 3 out of 13 Claude calls have completed.</p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-mono text-xs pt-0.5">Token count</span>
                  <p className="text-sm">Shows total tokens used so far. A full complex TIP typically uses 100,000–150,000 tokens.</p>
                </div>
              </div>
              <p className="mt-3">When generation completes, you are automatically taken to your new draft. No action required.</p>
            </>
          ),
        },
        {
          title: 'How Long Does It Take?',
          content: (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700 w-32 flex-shrink-0">Small workbook</span>
                <span className="text-gray-600">~1–2 minutes</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700 w-32 flex-shrink-0">Full workbook</span>
                <span className="text-gray-600">2–4 minutes</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700 w-32 flex-shrink-0">Large project</span>
                <span className="text-gray-600">4–6 minutes</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Time varies with Claude API load. Stay on the Generate page — the progress bar will update.</p>
            </div>
          ),
        },
        {
          title: 'Frequently Asked Questions',
          content: (
            <div className="space-y-3">
              <div>
                <p className="font-medium text-gray-800">Can I run multiple generations at the same time?</p>
                <p className="text-gray-600 mt-0.5">Not recommended. Each generation is a long-running background job and running two simultaneously may slow both down.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800">The page says "Generation failed" — what do I do?</p>
                <p className="text-gray-600 mt-0.5">Check the Drafts page for the failed draft and its error detail. Common causes: Claude API timeout, template not active, or corrupt Excel file.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800">Can I generate without a discovery document?</p>
                <p className="text-gray-600 mt-0.5">Yes, but quality will be lower. Without a discovery workbook the AI only has the service order and template structure to work from.</p>
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}
