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
import type { Group } from '@/data/db'
import { mutateUpsert, mutateInsert, mutateDelete } from '@/data/mutate'
import { useAppStore } from '@/data/store'
import { plural } from '@/lib/plural'

interface GroupFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: Group | null
}

function GroupFormSheet({ open, onOpenChange, group }: GroupFormSheetProps) {
  const [name, setName] = useState(group?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const actorId = useAppStore((s) => s.userId)

  // Reset fields each time the sheet opens (it stays mounted, only `open`
  // toggles — so a one-time useState initializer wouldn't re-run).
  useEffect(() => {
    if (open) {
      setName(group?.name ?? '')
      setError('')
    }
  }, [open, group])

  async function handleSave() {
    if (!name.trim()) { setError('Введите название'); return }
    setSaving(true)
    const isNew = !group
    const id = group?.id ?? crypto.randomUUID()
    const now = new Date().toISOString()

    const record: Group = {
      id,
      name: name.trim(),
      created_at: group?.created_at ?? now,
      updated_at: now,
    }

    const outcome = await mutateUpsert('groups', db.groups, record)

    if (actorId) {
      const logEntry = {
        id: crypto.randomUUID(),
        actor_id: actorId,
        event_type: isNew ? 'group_created' : 'group_updated',
        entity_type: 'group',
        entity_id: id,
        old_value: group ? { name: group.name } : null,
        new_value: { name: record.name },
        created_at: now,
      }
      await mutateInsert('audit_log', db.audit_log, logEntry)
    }

    if (outcome === 'queued') {
      toast.success('Сохранено офлайн — синхронизируется позже')
    } else {
      toast.success(isNew ? 'Группа добавлена' : 'Группа обновлена')
    }
    setSaving(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{group ? 'Редактировать группу' : 'Новая группа'}</DialogTitle>
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
              placeholder="Брусок, Наличник, Плинтус..."
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
            {saving ? '…' : group ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface GroupsSectionProps {
  groups: Group[]
}

export function GroupsSection({ groups }: GroupsSectionProps) {
  const actorId = useAppStore((s) => s.userId)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Group | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openNew() {
    setEditTarget(null)
    setFormOpen(true)
  }

  function openEdit(g: Group) {
    setEditTarget(g)
    setFormOpen(true)
  }

  async function handleDelete(g: Group) {
    // group_id is mandatory on products — block deletion of non-empty groups
    const count = await db.products.where('group_id').equals(g.id).count()
    if (count > 0) {
      const word = plural(count, ['товар', 'товара', 'товаров'])
      toast.error(`В группе ${count} ${word} — сначала перенесите или удалите их`)
      return
    }

    setDeletingId(g.id)
    const outcome = await mutateDelete('groups', db.groups, g.id)

    if (actorId) {
      const logEntry = {
        id: crypto.randomUUID(),
        actor_id: actorId,
        event_type: 'group_deleted',
        entity_type: 'group',
        entity_id: g.id,
        old_value: { name: g.name },
        new_value: null,
        created_at: new Date().toISOString(),
      }
      await mutateInsert('audit_log', db.audit_log, logEntry)
    }

    toast.success(outcome === 'queued' ? 'Удалено офлайн — синхронизируется позже' : 'Группа удалена')
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
            Группы
          </span>
          <button
            className="flex items-center gap-1 text-sm font-medium rounded-md px-2"
            style={{ height: 32, color: 'var(--primary)' }}
            onClick={openNew}
            aria-label="Добавить группу"
          >
            <Plus size={16} strokeWidth={1.5} />
            Добавить
          </button>
        </div>

        {groups.map((g, i) => (
          <div
            key={g.id}
            className="flex items-center"
            style={{
              borderBottom: i < groups.length - 1 ? '1px solid var(--border)' : undefined,
            }}
          >
            <button
              className="flex items-center gap-3 flex-1 px-4"
              style={{ height: 52, textAlign: 'left' }}
              onClick={() => openEdit(g)}
              aria-label={`Редактировать ${g.name}`}
            >
              <span className="flex-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {g.name}
              </span>
            </button>
            <button
              className="flex items-center justify-center rounded-md flex-shrink-0"
              style={{ width: 44, height: 52, color: '#EF4444', opacity: deletingId === g.id ? 0.5 : 1 }}
              onClick={() => handleDelete(g)}
              disabled={deletingId === g.id}
              aria-label={`Удалить ${g.name}`}
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        ))}

        {groups.length === 0 && (
          <div className="px-4 py-4 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Нет групп
          </div>
        )}
      </div>

      <GroupFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        group={editTarget}
      />
    </>
  )
}
