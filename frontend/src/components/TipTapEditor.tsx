import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import TurndownService from 'turndown'
import { marked } from 'marked'
import type { MarkedOptions } from 'marked'
import {
  Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, TableIcon, Undo2, Redo2,
  CheckSquare, Minus,
} from 'lucide-react'

// ── markdown → HTML (for loading into TipTap) ──────────────────────────────
function mdToHtml(md: string): string {
  return marked.parse(md, { async: false } as MarkedOptions) as string
}

// ── HTML → markdown (for saving back to backend) ───────────────────────────
const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })
td.addRule('taskListItem', {
  filter: node =>
    node.nodeName === 'LI' &&
    node.querySelector('input[type="checkbox"]') !== null,
  replacement: (content, node) => {
    const checkbox = (node as HTMLElement).querySelector('input[type="checkbox"]') as HTMLInputElement | null
    const checked = checkbox?.checked ? '[x]' : '[ ]'
    const text = content.replace(/^\s*\[[ x]\]\s*/i, '').trim()
    return `- ${checked} ${text}\n`
  },
})
td.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td'])

function htmlToMd(html: string): string {
  return td.turndown(html)
}

// ── Toolbar button ──────────────────────────────────────────────────────────
function Btn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded text-sm transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      } disabled:opacity-30`}
    >
      {children}
    </button>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
interface Props {
  value: string        // markdown
  onChange: (md: string) => void
}

export default function TipTapEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: mdToHtml(value),
    onUpdate: ({ editor }) => {
      onChange(htmlToMd(editor.getHTML()))
    },
  })

  // Re-sync if value changes externally (e.g. refine applies)
  useEffect(() => {
    if (!editor) return
    const current = htmlToMd(editor.getHTML())
    if (current !== value) {
      editor.commands.setContent(mdToHtml(value))
    }
  }, [value, editor])

  if (!editor) return null

  const insertTable = () =>
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()

  return (
    <div className="border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-gray-50">
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <Bold className="w-4 h-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <Italic className="w-4 h-4" />
        </Btn>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 className="w-4 h-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 className="w-4 h-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 className="w-4 h-4" />
        </Btn>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List className="w-4 h-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered className="w-4 h-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Checklist">
          <CheckSquare className="w-4 h-4" />
        </Btn>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <Btn onClick={insertTable} title="Insert table">
          <TableIcon className="w-4 h-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus className="w-4 h-4" />
        </Btn>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo2 className="w-4 h-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo2 className="w-4 h-4" />
        </Btn>

        {/* Table column/row controls — only visible when cursor is in a table */}
        {editor.isActive('table') && (
          <>
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <span className="text-xs text-gray-500 mr-1">Table:</span>
            <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().addColumnAfter().run() }} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-600">+Col</button>
            <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().addRowAfter().run() }} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-600">+Row</button>
            <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteColumn().run() }} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-red-500">-Col</button>
            <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteRow().run() }} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-red-500">-Row</button>
          </>
        )}
      </div>

      {/* Editor body */}
      <EditorContent
        editor={editor}
        className="min-h-[220px] max-h-[600px] overflow-y-auto p-3 text-sm text-gray-800 focus:outline-none tiptap-content"
      />
    </div>
  )
}
