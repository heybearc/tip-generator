import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, Save, Loader2 } from 'lucide-react'
import axios from 'axios'

const API_URL = '/api'

interface SectionItem {
  key: string
  position: number
  visible: boolean
}

function SortableRow({
  item,
  onToggle,
}: {
  item: SectionItem
  onToggle: (key: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm select-none ${
        item.visible
          ? 'bg-white border-gray-200'
          : 'bg-gray-50 border-gray-100 text-gray-400'
      } ${isDragging ? 'shadow-lg z-50' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className={`flex-1 truncate ${item.visible ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
        {item.key}
      </span>
      <button
        onClick={() => onToggle(item.key)}
        className={`flex-shrink-0 p-1 rounded transition-colors ${
          item.visible
            ? 'text-green-600 hover:bg-green-50'
            : 'text-gray-400 hover:bg-gray-100'
        }`}
        title={item.visible ? 'Hide from export' : 'Show in export'}
      >
        {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  )
}

export default function SectionManager({
  draftId,
  onClose,
}: {
  draftId: number
  onClose: () => void
}) {
  const [items, setItems] = useState<SectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    axios
      .get(`${API_URL}/generate/drafts/${draftId}/section-order`)
      .then(r => setItems(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [draftId])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems(prev => {
      const oldIdx = prev.findIndex(i => i.key === active.id)
      const newIdx = prev.findIndex(i => i.key === over.id)
      const reordered = arrayMove(prev, oldIdx, newIdx).map((item, idx) => ({
        ...item,
        position: idx,
      }))
      return reordered
    })
    setDirty(true)
  }, [])

  const handleToggle = useCallback((key: string) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, visible: !i.visible } : i))
    setDirty(true)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await axios.post(`${API_URL}/generate/drafts/${draftId}/section-order`, {
        sections: items,
      })
      setDirty(false)
    } catch {
      // silent — user can retry
    } finally {
      setSaving(false)
    }
  }

  const visibleCount = items.filter(i => i.visible).length

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-gray-800">Manage Sections</span>
          <span className="ml-2 text-xs text-gray-400">
            {visibleCount} of {items.length} visible in export
          </span>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items.map(i => i.key)} strategy={verticalListSortingStrategy}>
              {items.map(item => (
                <SortableRow key={item.key} item={item} onToggle={handleToggle} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Drag to reorder · Toggle eye to show/hide from export · Hidden sections remain editable
      </p>
    </div>
  )
}
