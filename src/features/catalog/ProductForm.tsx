import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { Tag } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { db } from '@/data/db'
import type { Product, Material, Group } from '@/data/db'
import { mutateUpsert, mutateInsert } from '@/data/mutate'
import { parseDecimalMm, sanitizeDecimalInput, matchGroupByName, caretToEnd } from '@/lib/utils'

type ProductType = 'unit' | 'round' | 'bulk'

interface ProductFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
  materials: Material[]
  groups: Group[]
  actorId: string | null
}

interface FormState {
  name: string
  display_name: string
  type: ProductType
  material_id: string
  group_id: string
  pack_size: string
  width_mm: string
  height_mm: string
  length_mm: string
  diameter_mm: string
}

const EMPTY: FormState = {
  name: '',
  display_name: '',
  type: 'unit',
  material_id: '',
  group_id: '',
  pack_size: '',
  width_mm: '',
  height_mm: '',
  length_mm: '',
  diameter_mm: '',
}

type DimKey = 'width_mm' | 'height_mm' | 'length_mm' | 'diameter_mm'

function toInt(s: string): number | null {
  const n = parseInt(s, 10)
  return isNaN(n) || n <= 0 ? null : n
}

function validate(f: FormState): string | null {
  if (!f.name.trim()) return 'Введите название'
  if (!f.material_id) return 'Выберите материал'
  if (!f.group_id) return 'Выберите группу'
  if (f.type === 'unit') {
    if (!parseDecimalMm(f.width_mm)) return 'Укажите ширину'
    if (!parseDecimalMm(f.height_mm)) return 'Укажите высоту'
    if (!parseDecimalMm(f.length_mm)) return 'Укажите длину'
  }
  if (f.type === 'round') {
    if (!parseDecimalMm(f.diameter_mm)) return 'Укажите диаметр'
    if (!parseDecimalMm(f.length_mm)) return 'Укажите длину'
  }
  return null
}

export function ProductForm({ open, onOpenChange, product, materials, groups, actorId }: ProductFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  // Once the user picks a group by hand, stop auto-filling it from the name.
  const [groupTouched, setGroupTouched] = useState(false)
  // The «отображаемое название» is edited in a separate dialog opened by the
  // square Tag button to the right of the name.
  const [displayNameDialogOpen, setDisplayNameDialogOpen] = useState(false)

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          name: product.name,
          display_name: product.display_name ?? '',
          type: product.type as ProductType,
          material_id: product.material_id,
          group_id: product.group_id ?? '',
          pack_size: String(product.pack_size),
          width_mm: product.width_mm != null ? String(product.width_mm) : '',
          height_mm: product.height_mm != null ? String(product.height_mm) : '',
          length_mm: product.length_mm != null ? String(product.length_mm) : '',
          diameter_mm: product.diameter_mm != null ? String(product.diameter_mm) : '',
        })
      } else {
        setForm({ ...EMPTY, material_id: materials[0]?.id ?? '' })
      }
      setGroupTouched(false)
      setDisplayNameDialogOpen(false)
      setError(null)
    }
  }, [open, product, materials, groups])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  /** Auto-assign a group from the name's first word, matching an EXISTING group
   *  (tolerant of singular/plural — see matchGroupByName). Stops once the user
   *  has chosen a group manually. */
  function setName(value: string) {
    setError(null)
    setForm((prev) => {
      if (groupTouched) return { ...prev, name: value }
      const matchId = matchGroupByName(value, groups)
      return { ...prev, name: value, group_id: matchId ?? prev.group_id }
    })
  }

  function setGroup(value: string) {
    setGroupTouched(true)
    set('group_id', value)
  }

  async function handleSave() {
    const err = validate(form)
    if (err) { setError(err); setShakeKey((k) => k + 1); return }

    setSaving(true)
    const isNew = !product
    const id = product?.id ?? crypto.randomUUID()
    const now = new Date().toISOString()

    const record: Product = {
      id,
      name: form.name.trim(),
      display_name: form.display_name.trim() || null,
      type: form.type,
      material_id: form.material_id,
      group_id: form.group_id,
      pack_size: toInt(form.pack_size) ?? 1,
      width_mm: (form.type === 'unit' || form.type === 'bulk') ? parseDecimalMm(form.width_mm) : null,
      height_mm: (form.type === 'unit' || form.type === 'bulk') ? parseDecimalMm(form.height_mm) : null,
      length_mm: (form.type === 'unit' || form.type === 'round' || form.type === 'bulk') ? parseDecimalMm(form.length_mm) : null,
      diameter_mm: form.type === 'round' ? parseDecimalMm(form.diameter_mm) : null,
      created_at: product?.created_at ?? now,
      updated_at: now,
    }

    const outcome = await mutateUpsert('products', db.products, record)

    if (actorId) {
      const logEntry = {
        id: crypto.randomUUID(),
        actor_id: actorId,
        event_type: isNew ? 'product_created' : 'product_updated',
        entity_type: 'product',
        entity_id: id,
        old_value: product ? { name: product.name } : null,
        new_value: { name: record.name },
        created_at: now,
      }
      await mutateInsert('audit_log', db.audit_log, logEntry)
    }

    if (outcome === 'queued') {
      toast.success('Сохранено офлайн — синхронизируется позже')
    } else {
      toast.success(isNew ? 'Товар добавлен' : 'Товар обновлён')
    }
    setSaving(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton preventOutsideClose className="max-h-[88dvh] !flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{product ? 'Редактировать товар' : 'Добавить товар'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1 min-h-0">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="ui-field-label">
              Название <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setName(e.target.value)}
                onFocus={caretToEnd}
                placeholder="Брусок, Труба ПВХ, Штапик..."
                className="flex-1 min-w-0 rounded-md border px-3 text-base"
                style={{
                  height: 44,
                  fontSize: 16,
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setDisplayNameDialogOpen(true)}
                aria-label="Отображаемое название"
                className="flex items-center justify-center rounded-md border flex-shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  background: form.display_name ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'var(--background)',
                  borderColor: form.display_name ? 'var(--primary)' : 'var(--border)',
                  color: form.display_name ? 'var(--primary)' : 'var(--foreground)',
                }}
              >
                <Tag size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="ui-field-label">
              Тип <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div className="flex gap-2">
              {(['unit', 'round', 'bulk'] as ProductType[]).map((t) => (
                <button
                  key={t}
                  className="flex-1 rounded-md border text-sm font-medium"
                  style={{
                    height: 44,
                    background: form.type === t ? 'var(--primary)' : 'var(--background)',
                    color: form.type === t ? 'var(--primary-foreground)' : 'var(--foreground)',
                    borderColor: form.type === t ? 'var(--primary)' : 'var(--border)',
                  }}
                  onClick={() => set('type', t)}
                >
                  {t === 'unit' ? 'Штучный' : t === 'round' ? 'Круглый' : 'Навалом'}
                </button>
              ))}
            </div>
          </div>

          {/* Material + Group */}
          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="ui-field-label">
                Материал <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={form.material_id}
                onChange={(e) => set('material_id', e.target.value)}
                className="rounded-md border px-3 text-base"
                style={{
                  height: 44,
                  fontSize: 16,
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  outline: 'none',
                  appearance: 'auto',
                }}
              >
                <option value="">Выбрать...</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="ui-field-label">
                Группа <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={form.group_id}
                onChange={(e) => setGroup(e.target.value)}
                className="rounded-md border px-3 text-base"
                style={{
                  height: 44,
                  fontSize: 16,
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  outline: 'none',
                  appearance: 'auto',
                }}
              >
                <option value="">Выбрать...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pack size */}
          <div className="flex flex-col gap-1.5">
            <label className="ui-field-label">
              Размер пачки (шт)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={form.pack_size}
              onChange={(e) => set('pack_size', e.target.value)}
              placeholder="4"
              className="rounded-md border px-3 text-base"
              style={{
                height: 44,
                fontSize: 16,
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
            <p className="ui-hint">Оставьте пустым, если товар поштучно</p>
          </div>

          {/* Unit / bulk dimensions */}
          {(form.type === 'unit' || form.type === 'bulk') && (
            <div className="flex flex-col gap-2">
              <p className="ui-section-title">
                {form.type === 'unit' ? 'Размеры' : 'Размеры (необязательно)'}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'height_mm', label: 'Высота, мм', placeholder: '40' },
                  { key: 'width_mm', label: 'Ширина, мм', placeholder: '50' },
                  { key: 'length_mm', label: 'Длина, мм', placeholder: '3000' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="ui-field-label">
                      {label}{form.type === 'unit' && <span style={{ color: '#EF4444' }}> *</span>}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form[key as DimKey]}
                      onChange={(e) => set(key as DimKey, sanitizeDecimalInput(e.target.value))}
                      placeholder={placeholder}
                      className="rounded-md border px-2 text-base text-center"
                      style={{
                        height: 44,
                        fontSize: 16,
                        background: 'var(--background)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                        outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Round fields */}
          {form.type === 'round' && (
            <div className="flex flex-col gap-2">
              <p className="ui-section-title">
                Размеры
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'diameter_mm', label: 'Диаметр, мм', placeholder: '110' },
                  { key: 'length_mm', label: 'Длина, мм', placeholder: '2000' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="ui-field-label">
                      {label} <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form[key as DimKey]}
                      onChange={(e) => set(key as DimKey, sanitizeDecimalInput(e.target.value))}
                      placeholder={placeholder}
                      className="rounded-md border px-2 text-base text-center"
                      style={{
                        height: 44,
                        fontSize: 16,
                        background: 'var(--background)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                        outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}


        </div>

        {/* Error */}
        {error && (
          <motion.p
            key={shakeKey}
            className="text-sm flex-shrink-0"
            style={{ color: '#EF4444' }}
            animate={{ x: [0, -8, 8, -6, 6, 0] }}
            transition={{ duration: 0.3 }}
          >
            {error}
          </motion.p>
        )}

        {/* Save */}
        <button
          className="btn-primary w-full rounded-md font-semibold text-base flex-shrink-0"
          style={{
            height: 56,
            opacity: saving ? 0.7 : 1,
          }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '…' : product ? 'Сохранить' : 'Добавить'}
        </button>
      </DialogContent>

      {/* Display name — edited in its own dialog. Value already lives in `form`. */}
      <Dialog open={displayNameDialogOpen} onOpenChange={setDisplayNameDialogOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Отображаемое название</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => set('display_name', e.target.value)}
              onFocus={caretToEnd}
              placeholder="Отображаемое название"
              className="rounded-md border px-3 text-base"
              style={{
                height: 44,
                fontSize: 16,
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
            <p className="ui-hint">
              Как товар показывается сотрудникам в стеллаже, заявке и т.д. Пусто — показывается полное имя.
            </p>
            <button
              className="btn-primary w-full rounded-md font-semibold text-base"
              style={{ height: 52 }}
              onClick={() => setDisplayNameDialogOpen(false)}
            >
              Готово
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
