import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface PlaygroundPrefsProps {
  allNames: string[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function PlaygroundPrefs({ allNames, selected, onChange }: PlaygroundPrefsProps) {
  const [items, setItems] = useState(() => {
    const rest = allNames.filter((n) => !selected.includes(n))
    return [...selected, ...rest].map((name) => ({
      id: name,
      checked: selected.length === 0 || selected.includes(name),
    }))
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id)
        const newIndex = prev.findIndex((i) => i.id === over.id)
        const next = arrayMove(prev, oldIndex, newIndex)
        onChange(next.filter((i) => i.checked).map((i) => i.id))
        return next
      })
    }
  }

  function handleToggle(name: string) {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === name ? { ...i, checked: !i.checked } : i))
      onChange(next.filter((i) => i.checked).map((i) => i.id))
      return next
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {items.map((item) => (
            <SortableItem key={item.id} item={item} onToggle={handleToggle} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({ item, onToggle }: { item: { id: string; checked: boolean }; onToggle: (name: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-sm select-none transition-colors hover:border-slate-300 ${isDragging ? 'opacity-40' : ''}`}
    >
      <span {...attributes} {...listeners} className="text-slate-400 text-[10px] cursor-grab">
        ⠿
      </span>
      <label className="flex items-center gap-1 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => onToggle(item.id)}
          className="accent-slate-900"
        />
        {item.id}
      </label>
    </div>
  )
}
