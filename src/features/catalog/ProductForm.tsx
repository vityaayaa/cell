import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { db } from '@/data/db'
import type { Product, Material } from '@/data/db'
import { supabase } from '@/data/supabase'
import { parseDecimalMm, sanitizeDecimalInput } from '@/lib/utils'

type ProductType = 'unit' | 'round' | 'bulk'

interface ProductFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
  materials: Material[]
  actorId: string | null
}

interface FormState {
  name: string
  type: ProductType
  material_id: string
  pack_size: string
  width_mm: string
  height_mm: string
  length_mm: string
  diameter_mm: string
}

const EMPTY: FormState = {
  name: '',
  type: 'unit',
  material_id: '',
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

export function ProductForm({ open, onOpenChange, product, materials, actorId }: ProductFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shakeKey, setShakeKey] = useState(0)

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          name: product.name,
          type: product.type as ProductType,
          material_id: product.material_id,
          pack_size: String(product.pack_size),
          width_mm: product.width_mm != null ? String(product.width_mm) : '',
          height_mm: product.height_mm != null ? String(product.height_mm) : '',
          length_mm: product.length_mm != null ? String(product.length_mm) : '',
          diameter_mm: product.diameter_mm != null ? String(product.diameter_mm) : '',
        })
      } else {
        setForm({ ...EMPTY, material_id: materials[0]?.id ?? '' })
      }
      setError(null)
    }
  }, [open, product, materials])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
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
      type: form.type,
      material_id: form.material_id,
      pack_size: toInt(form.pack_size) ?? 1,
      width_mm: (form.type === 'unit' || form.type === 'bulk') ? parseDecimalMm(form.width_mm) : null,
      height_mm: (form.type === 'unit' || form.type === 'bulk') ? parseDecimalMm(form.height_mm) : null,
      length_mm: (form.type === 'unit' || form.type === 'round' || form.type === 'bulk') ? parseDecimalMm(form.length_mm) : null,
      diameter_mm: form.type === 'round' ? parseDecimalMm(form.diameter_mm) : null,
      created_at: product?.created_at ?? now,
      updated_at: now,
    }

    await db.products.put(record)
    const { error: sbErr } = await supabase.from('products').upsert(record)
    if (sbErr) {
      await db.products.delete(id)
      toast.error('Не сохранилось — нет связи')
      setSaving(false)
      return
    }

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
      await db.audit_log.add(logEntry)
      await supabase.from('audit_log').insert(logEntry)
    }

    toast.success(isNew ? 'Товар добавлен' : 'Товар обновлён')
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
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Брусок, Труба ПВХ, Штапик..."
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

          {/* Material */}
          <div className="flex flex-col gap-1.5">
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
    </Dialog>
  )
}
