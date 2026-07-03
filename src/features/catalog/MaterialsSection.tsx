import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { db } from '@/data/db'
import type { Material } from '@/data/db'
import { mutateUpsert, mutateInsert, mutateDelete } from '@/data/mutate'
import { useAppStore } from '@/data/store'
import { caretToEnd } from '@/lib/utils'

interface MaterialFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  material?: Material | null
}

function MaterialFormSheet({ open, onOpenChange, material }: MaterialFormSheetProps) {
  const [name, setName] = useState(material?.name ?? '')
  const [color, setColor] = useState(material?.color ?? '#888888')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const actorId = useAppStore((s) => s.userId)

  // Reset fields each time the sheet opens (it stays mounted, only `open`
  // toggles — so a one-time useState initializer wouldn't re-run).
  useEffect(() => {
    if (open) {
      setName(material?.name ?? '')
      setColor(material?.color ?? '#888888')
      setError('')
    }
  }, [open, material])

  async function handleSave() {
    if (!name.trim()) { setError('Введите название'); return }
    setSaving(true)
    const isNew = !material
    const id = material?.id ?? crypto.randomUUID()
    const now = new Date().toISOString()

    const record: Material = {
      id,
      name: name.trim(),
      color,
      is_custom: true,
      created_at: material?.created_at ?? now,
      updated_at: now,
    }

    const outcome = await mutateUpsert('materials', db.materials, record)

    if (actorId) {
      const logEntry = {
        id: crypto.randomUUID(),
        actor_id: actorId,
        event_type: isNew ? 'material_created' : 'material_updated',
        entity_type: 'material',
        entity_id: id,
        old_value: material ? { name: material.name } : null,
        new_value: { name: record.name, color: record.color },
        created_at: now,
      }
      await mutateInsert('audit_log', db.audit_log, logEntry)
    }

    if (outcome === 'queued') {
      toast.success('Сохранено офлайн — синхронизируется позже')
    } else {
      toast.success(isNew ? 'Материал добавлен' : 'Материал обновлён')
    }
    setSaving(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{material ? 'Редактировать материал' : 'Новый материал'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="ui-field-label">
              Название <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              onFocus={caretToEnd}
              placeholder="Дерево, Пластик, Металл..."
              className="rounded-md border px-3 text-base"
              style={{
                height: 48,
                fontSize: 16,
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="ui-field-label">
              Цвет
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="rounded-md border"
                style={{
                  width: 48,
                  height: 48,
                  borderColor: 'var(--border)',
                  cursor: 'pointer',
                  padding: 2,
                }}
              />
              <span className="text-sm font-mono" style={{ color: 'var(--muted-foreground)' }}>
                {color.toUpperCase()}
              </span>
            </div>
          </div>
          {error && <p className="text-sm" style={{ color: '#EF4444' }}>{error}</p>}
          <button
            className="btn-primary w-full rounded-md font-semibold text-base"
            style={{
              height: 56,
              opacity: saving ? 0.7 : 1,
            }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '…' : material ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface MaterialsSectionProps {
  materials: Material[]
}

export function MaterialsSection({ materials }: MaterialsSectionProps) {
  const actorId = useAppStore((s) => s.userId)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Material | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openNew() {
    setEditTarget(null)
    setFormOpen(true)
  }

  function openEdit(m: Material) {
    setEditTarget(m)
    setFormOpen(true)
  }

  async function handleDelete(m: Material) {
    if (!m.is_custom) return
    setDeletingId(m.id)
    const outcome = await mutateDelete('materials', db.materials, m.id)

    if (actorId) {
      const logEntry = {
        id: crypto.randomUUID(),
        actor_id: actorId,
        event_type: 'material_deleted',
        entity_type: 'material',
        entity_id: m.id,
        old_value: { name: m.name },
        new_value: null,
        created_at: new Date().toISOString(),
      }
      await mutateInsert('audit_log', db.audit_log, logEntry)
    }

    toast.success(outcome === 'queued' ? 'Удалено офлайн — синхронизируется позже' : 'Материал удалён')
    setDeletingId(null)
  }

  return (
    <>
      <div
        className="mx-4 mt-6 mb-2 rounded-lg border overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}
        >
          <span className="ui-section-title">
            Материалы
          </span>
          <button
            className="flex items-center gap-1 text-sm font-medium rounded-md px-2"
            style={{ height: 32, color: 'var(--primary)' }}
            onClick={openNew}
            aria-label="Добавить материал"
          >
            <Plus size={16} strokeWidth={1.5} />
            Добавить
          </button>
        </div>

        {materials.map((m, i) => (
          <div
            key={m.id}
            className="flex items-center"
            style={{
              borderBottom: i < materials.length - 1 ? '1px solid var(--border)' : undefined,
            }}
          >
            <button
              className="flex items-center gap-3 flex-1 px-4"
              style={{ height: 52, textAlign: 'left' }}
              onClick={() => openEdit(m)}
              aria-label={`Редактировать ${m.name}`}
            >
              <div
                className="rounded-full flex-shrink-0"
                style={{ width: 14, height: 14, background: m.color }}
                aria-hidden
              />
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {m.name}
              </span>
              <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
                {m.color.toUpperCase()}
              </span>
            </button>
            {m.is_custom && (
              <button
                className="flex items-center justify-center rounded-md flex-shrink-0"
                style={{ width: 44, height: 52, color: '#EF4444', opacity: deletingId === m.id ? 0.5 : 1 }}
                onClick={() => handleDelete(m)}
                disabled={deletingId === m.id}
                aria-label={`Удалить ${m.name}`}
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        ))}

        {materials.length === 0 && (
          <div className="px-4 py-4 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Нет материалов
          </div>
        )}
      </div>

      <MaterialFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        material={editTarget}
      />
    </>
  )
}
