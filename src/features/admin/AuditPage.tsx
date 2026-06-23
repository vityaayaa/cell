import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft } from 'lucide-react'
import { db } from '@/data/db'
import type { AuditLog, UserProfile } from '@/data/db'

const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatAuditEvent(log: AuditLog): string {
  const nv = log.new_value as Record<string, unknown> | null
  const ov = log.old_value as Record<string, unknown> | null
  switch (log.event_type) {
    case 'product_created': return `Товар добавлен: ${nv?.name ?? log.entity_id}`
    case 'product_updated': return `Товар изменён: ${nv?.name ?? log.entity_id}`
    case 'product_deleted': return `Товар удалён: ${ov?.name ?? log.entity_id}`
    case 'material_created': return `Материал добавлен: ${nv?.name ?? log.entity_id}`
    case 'material_updated': return `Материал изменён: ${nv?.name ?? log.entity_id}`
    case 'material_deleted': return `Материал удалён: ${ov?.name ?? log.entity_id}`
    case 'session_started': return 'Обход начат'
    case 'session_completed': return 'Обход завершён'
    case 'session_abandoned': return `Обход заброшен${nv?.by ? ` (инициировал ${nv.by})` : ''}`
    case 'cell_split': return `Ячейка разделена: ${log.entity_id}`
    case 'cell_merged': return `Ячейки объединены`
    case 'cell_product_assigned': return `Товар назначен на ячейку`
    case 'cell_product_unassigned': return `Товар снят с ячейки`
    case 'cell_capacity_override': return `Вместимость ячейки изменена`
    case 'cell_needs_review_confirmed': return `Флаг проверки подтверждён`
    case 'stock_entry_created': return `Остаток внесён`
    case 'stock_entry_updated': return `Остаток исправлен`
    case 'order_line_deleted': return `Строка заявки удалена`
    case 'order_line_updated': return `Строка заявки изменена`
    case 'order_line_added': return `Строка заявки добавлена`
    case 'order_finalized': return `Заявка финализирована`
    case 'checklist_entry_marked': return `Позиция отмечена: ${nv?.status ?? ''}`
    case 'user_created': return `Пользователь создан: ${nv?.name ?? log.entity_id}`
    case 'user_blocked': return `Пользователь заблокирован`
    case 'user_unblocked': return `Пользователь разблокирован`
    case 'user_deleted': return `Пользователь удалён`
    case 'user_login': return 'Вход в систему'
    case 'user_logout': return 'Выход из системы'
    default: return log.event_type.replace(/_/g, ' ')
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  product: 'Каталог',
  material: 'Каталог',
  session: 'Обход',
  cell: 'Стеллаж',
  stock: 'Остатки',
  order: 'Заявка',
  checklist: 'Чеклист',
  user: 'Аккаунты',
  auth: 'Аутентификация',
}

const ALL_CATEGORIES = [
  { value: '', label: 'Все категории' },
  { value: 'product', label: 'Каталог' },
  { value: 'session', label: 'Обход' },
  { value: 'cell', label: 'Стеллаж' },
  { value: 'stock', label: 'Остатки' },
  { value: 'order', label: 'Заявка' },
  { value: 'checklist', label: 'Чеклист' },
  { value: 'user', label: 'Аккаунты' },
  { value: 'auth', label: 'Аутентификация' },
]

function entityTypeToCategory(entityType: string): string {
  if (entityType === 'product' || entityType === 'material') return 'product'
  if (entityType.startsWith('stock')) return 'stock'
  if (entityType.startsWith('checklist')) return 'checklist'
  return entityType
}

export default function AuditPage() {
  const navigate = useNavigate()
  const [filterUserId, setFilterUserId] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const profiles = useLiveQuery(() => db.user_profiles.toArray())
  const logs = useLiveQuery<AuditLog[]>(
    () => db.audit_log.orderBy('created_at').reverse().toArray(),
  )

  const profileMap = new Map<string, UserProfile>((profiles ?? []).map((p) => [p.id, p]))

  const filteredLogs = (logs ?? []).filter((l) => {
    if (filterUserId && l.actor_id !== filterUserId) return false
    if (filterCategory) {
      const cat = entityTypeToCategory(l.entity_type)
      if (cat !== filterCategory) return false
    }
    if (filterFrom && l.created_at < filterFrom) return false
    if (filterTo && l.created_at > filterTo + 'T23:59:59Z') return false
    return true
  })

  const loading = !logs || !profiles

  return (
    <div
      className="flex flex-col min-h-dvh"
      style={{ background: 'var(--background)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4"
        style={{
          height: 56,
          borderBottom: '1px solid var(--border)',
          background: 'var(--background)',
        }}
      >
        <button
          className="flex items-center justify-center rounded-md"
          style={{ width: 40, height: 40, color: 'var(--foreground)' }}
          onClick={() => navigate(-1)}
          aria-label="Назад"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
        <h1 className="flex-1 text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          Журнал действий
        </h1>
      </div>

      {/* Filters */}
      <div
        className="flex flex-col gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}
      >
        <div className="grid grid-cols-2 gap-2">
          {/* User filter */}
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="rounded-md border px-2 text-sm"
            style={{
              height: 40,
              fontSize: 14,
              background: 'var(--background)',
              borderColor: 'var(--border)',
              color: filterUserId ? 'var(--foreground)' : 'var(--muted-foreground)',
              outline: 'none',
            }}
            aria-label="Фильтр по пользователю"
          >
            <option value="">Все пользователи</option>
            {(profiles ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-md border px-2 text-sm"
            style={{
              height: 40,
              fontSize: 14,
              background: 'var(--background)',
              borderColor: 'var(--border)',
              color: filterCategory ? 'var(--foreground)' : 'var(--muted-foreground)',
              outline: 'none',
            }}
            aria-label="Фильтр по категории"
          >
            {ALL_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Quick period presets */}
        <div className="flex gap-2">
          {[
            { label: 'Месяц', days: 30 },
            { label: 'Полгода', days: 182 },
            { label: 'Год', days: 365 },
          ].map(({ label, days }) => {
            const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
            const to = new Date().toISOString().slice(0, 10)
            const active = filterFrom === from && filterTo === to
            return (
              <button
                key={label}
                onClick={() => { setFilterFrom(from); setFilterTo(to) }}
                className="flex-1 rounded-md text-sm font-medium"
                style={{
                  height: 36,
                  background: active ? 'var(--primary)' : 'var(--background)',
                  color: active ? 'var(--primary-foreground)' : 'var(--foreground)',
                  border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                }}
              >
                {label}
              </button>
            )
          })}
          {(filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterFrom(''); setFilterTo('') }}
              className="rounded-md text-sm px-3"
              style={{
                height: 36,
                background: 'var(--background)',
                color: 'var(--muted-foreground)',
                border: '1px solid var(--border)',
              }}
            >
              Сброс
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <label className="ui-field-label">С:</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="rounded-md border px-2 text-sm"
              style={{
                height: 40,
                fontSize: 14,
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="ui-field-label">По:</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="rounded-md border px-2 text-sm"
              style={{
                height: 40,
                fontSize: 14,
                background: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Log list */}
      {loading ? (
        <div className="flex items-center justify-center flex-1 py-16">
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
          />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-8 py-16">
          <p className="text-base text-center" style={{ color: 'var(--muted-foreground)' }}>
            Нет событий
          </p>
          <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
            {logs.length > 0 ? 'Попробуйте изменить фильтры' : 'Действия появятся здесь после работы с приложением'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {filteredLogs.map((log, i) => {
            const actor = log.actor_id ? profileMap.get(log.actor_id) : null
            const cat = entityTypeToCategory(log.entity_type)
            const catLabel = CATEGORY_LABELS[cat] ?? log.entity_type
            return (
              <div
                key={log.id}
                className="px-4 py-3"
                style={{
                  borderBottom: i < filteredLogs.length - 1 ? '1px solid var(--border)' : undefined,
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {formatDateTime(log.created_at)}
                    {actor ? <> · <span style={{ color: 'var(--foreground)' }}>{actor.name}</span></> : null}
                  </span>
                  <span
                    className="text-xs rounded-full px-2 py-0.5 border"
                    style={{
                      color: 'var(--muted-foreground)',
                      borderColor: 'var(--border)',
                      background: 'var(--muted)',
                    }}
                  >
                    {catLabel}
                  </span>
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {formatAuditEvent(log)}
                </p>
              </div>
            )
          })}
          <div style={{ height: 32 }} />
        </div>
      )}
    </div>
  )
}
