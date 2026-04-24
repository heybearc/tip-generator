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
              <li>Optionally add <strong>Author Instructions</strong> to guide Claude's writing style (see below).</li>
              <li>Select a <strong>Discovery Document</strong> (your Excel workbook) from the dropdown.</li>
              <li>Optionally select a <strong>Service Order</strong> (PDF).</li>
              <li>Click <strong>Generate TIP</strong>.</li>
            </ol>
          ),
        },
        {
          title: 'Author Instructions & Presets',
          content: (
            <>
              <p>The <strong>Author Instructions</strong> field lets you give Claude specific writing guidance before generation starts. This is useful for controlling tone, depth, and style across the entire document.</p>
              <div className="mt-3 space-y-2">
                <div className="p-3 bg-gray-50 rounded-lg text-sm">
                  <p className="font-medium text-gray-700 mb-1">Example instructions:</p>
                  <ul className="list-disc ml-4 space-y-1 text-gray-600">
                    <li>"Write at a high-level architecture level, not step-by-step engineering."</li>
                    <li>"Assume the reader is a project manager, not a network engineer."</li>
                    <li>"Be concise — no section should exceed 3 paragraphs."</li>
                    <li>"Use Thrive's voice: professional, direct, and client-facing."</li>
                  </ul>
                </div>
              </div>
              <p className="mt-3"><strong>Saving as a Preset:</strong> If you use the same instructions for every TIP, save them as a preset so you don't have to retype them:</p>
              <ol className="list-decimal ml-4 space-y-1 mt-2 text-sm">
                <li>Type your instructions in the Author Instructions field.</li>
                <li>Click <strong>Save as preset</strong> and give it a name.</li>
                <li>Next time, click any saved preset to load it instantly.</li>
              </ol>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                <strong>Tip:</strong> Presets are saved to your profile and persist across sessions. You can save multiple presets for different client types or document styles.
              </div>
            </>
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
              <div>
                <p className="font-medium text-gray-800">Can I stop a generation that's already running?</p>
                <p className="text-gray-600 mt-0.5">Yes — go to the Drafts page and click <strong>Cancel</strong> on the generating draft. The job stops immediately and the draft moves to "cancelled" status with whatever content was completed up to that point.</p>
              </div>
            </div>
          ),
        },
      ]}
    />
  )
}
