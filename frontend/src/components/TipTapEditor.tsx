import { useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import TurndownService from 'turndown'
import { marked } from 'marked'
import type { MarkedOptions } from 'marked'
import {
  Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, TableIcon, Undo2, Redo2,
  CheckSquare, Minus, ChevronDown,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from 'lucide-react'

// ── Structured table templates (Thrive TIP standard) ───────────────────────
const TABLE_TEMPLATES = [
  {
    label: 'Blank table (3×3)',
    html: null,  // use insertTable command
    rows: 3, cols: 3,
  },
  {
    label: 'Risks & Contingencies',
    html: `<table><thead><tr><th>Risk</th><th>Likelihood</th><th>Mitigation Strategy</th><th>Rollback Plan</th></tr></thead><tbody><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></tbody></table>`,
  },
  {
    label: 'Acceptance Criteria',
    html: `<table><thead><tr><th>#</th><th>Acceptance Criterion</th><th>Verification Method</th></tr></thead><tbody><tr><td>1</td><td></td><td></td></tr><tr><td>2</td><td></td><td></td></tr></tbody></table>`,
  },
  {
    label: 'Deliverables',
    html: `<table><thead><tr><th>#</th><th>Deliverable</th><th>Description</th><th>Expected Date</th></tr></thead><tbody><tr><td>1</td><td></td><td></td><td></td></tr><tr><td>2</td><td></td><td></td><td></td></tr></tbody></table>`,
  },
]

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

// Preserve text-align on block elements as HTML passthrough
td.addRule('alignedBlock', {
  filter: (node) => {
    const el = node as HTMLElement
    const tag = el.nodeName
    const isBlock = ['P', 'H1', 'H2', 'H3', 'H4'].includes(tag)
    const align = el.style?.textAlign
    return isBlock && !!align && align !== 'left'
  },
  replacement: (content, node) => {
    const el = node as HTMLElement
    const align = el.style.textAlign
    return `\n<p style="text-align:${align}">${content}</p>\n`
  },
})

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
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ['heading', 'paragraph', 'tableCell', 'tableHeader'] }),
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

  const [tableMenuOpen, setTableMenuOpen] = useState(false)
  const tableMenuRef = useRef<HTMLDivElement>(null)

  // Close table dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
        setTableMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!editor) return null

  const insertTableTemplate = (tpl: typeof TABLE_TEMPLATES[number]) => {
    setTableMenuOpen(false)
    if (tpl.html) {
      editor.chain().focus().insertContent(tpl.html).run()
    } else {
      editor.chain().focus().insertTable({ rows: tpl.rows ?? 3, cols: tpl.cols ?? 3, withHeaderRow: true }).run()
    }
  }

  const confirmDelete = (action: () => void, label: string) => {
    if (window.confirm(`Delete this ${label}? This cannot be undone — use Undo (Ctrl+Z) to recover if needed.`)) {
      action()
    }
  }

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

        <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
          <AlignLeft className="w-4 h-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
          <AlignCenter className="w-4 h-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
          <AlignRight className="w-4 h-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
          <AlignJustify className="w-4 h-4" />
        </Btn>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        {/* Table insert dropdown */}
        <div className="relative" ref={tableMenuRef}>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setTableMenuOpen(o => !o) }}
            title="Insert table"
            className="flex items-center gap-0.5 p-1.5 rounded text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <TableIcon className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </button>
          {tableMenuOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[210px]">
              {TABLE_TEMPLATES.map(tpl => (
                <button
                  key={tpl.label}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); insertTableTemplate(tpl) }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 text-gray-700"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus className="w-4 h-4" />
        </Btn>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
          <Undo2 className="w-4 h-4" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
          <Redo2 className="w-4 h-4" />
        </Btn>

        {/* Table column/row controls — only visible when cursor is in a table */}
        {editor.isActive('table') && (
          <>
            <span className="w-px h-5 bg-gray-200 mx-1" />
            <span className="text-xs text-gray-500 mr-1">Table:</span>
            <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().addColumnAfter().run() }} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-600">+Col</button>
            <button type="button" onMouseDown={e => { e.preventDefault(); editor.chain().focus().addRowAfter().run() }} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-600">+Row</button>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); confirmDelete(() => editor.chain().focus().deleteColumn().run(), 'column') }}
              className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-500"
            >-Col</button>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); confirmDelete(() => editor.chain().focus().deleteRow().run(), 'row') }}
              className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-500"
            >-Row</button>
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
