# I-06 — Checklist + Sessions Screen

## Контекст

I-01–I-05 завершены: domain-логика, data layer, навигация, ShelfGrid, форма ввода остатков, черновик заявки и финализация — всё готово. Эта сессия — чеклист (фаза `fulfilling`), экран «Сессии» (единый для обеих ролей) и экран деталей завершённой сессии.

---

### Создано в I-05 (инвентарь)

**`src/features/sessions/startSweep.ts`** — `export async function startSweep(userId: string): Promise<string>`. Создаёт Session с status='sweeping', optimistic Dexie→Supabase. Возвращает sessionId.

**`src/features/shelf/useSweepProgress.ts`** — `export function useSweepProgress(sessionId: string | null): SweepProgress`. Возвращает `{ visited: number, total: number, visitedCellIds: Set<string> }`. Считает листовые ячейки с product_id через isLeaf + Dexie livequeries.

**`src/features/shelf/SweepProgressBar.tsx`** — `export function SweepProgressBar({ visited, total, sessionId })`. Sticky прогресс-бар. При нажатии «→ К заявке» вызывает `generateOrder(sessionId)`, затем `navigate('/app/order')`. Диалог подтверждения при < 50% ячеек.

**`src/features/stock/StockEntryPage.tsx`** — страница ввода остатка. Unit/round: числовой ввод (`inputMode="numeric"`, 16px). Bulk: shadcn Slider (0–100%), `≈ N пачек = round(percent/100 × capacity)`. Optimistic write + Sonner toast с Motion progress bar. После сохранения: `navigate(-1)`.

**`src/features/order/updateSessionStatus.ts`** — `export async function updateSessionStatus(sessionId: string, status: Session['status']): Promise<void>`. При terminal-статусах (abandoned/completed) также записывает `finished_at`. Импорт: `import { updateSessionStatus } from '@/features/order/updateSessionStatus'`.

**`src/features/order/generateOrder.ts`** — `export async function generateOrder(sessionId: string): Promise<string>`. Собирает последний StockEntry на каждую ячейку → buildOrderLines() → создаёт Order + OrderLines в Dexie + Supabase → меняет статус сессии на 'ordering'. Возвращает orderId. Импорт: `import { generateOrder } from '@/features/order/generateOrder'`.

**`src/features/order/OrderDraftPage.tsx`** — черновик заявки (`/app/order`). LiveQuery по `activeSessionId → order → allLines`. Основные строки + блок «Пограничные позиции». Sheets: OrderLineSheet (изменить пачки / удалить), BoundaryLineSheet (включить в заявку), FinalizeSheet (итог + необратимый переход).

**`src/features/order/OrderLineSheet.tsx`** — экспортирует три компонента:
- `OrderLineSheet` — редактирование quantity_packs, удаление строки
- `BoundaryLineSheet` — включить пограничную позицию (is_boundary=false, quantity_packs=1)
- `FinalizeSheet` — итог (N позиций, M пачек) + кнопка «Финализировать →» → создаёт ChecklistEntries, updateSessionStatus('fulfilling'), navigate('/app/checklist/:sessionId')

**Маршрут `/app/checklist/:sessionId`** — ожидает `sessionId` из params. ChecklistPage (заглушка) уже существует по этому маршруту в router.tsx. Задача I-06 — заменить заглушку.

**Структура ChecklistEntry** (из db.ts / database.types):
```typescript
{
  id: string
  order_line_id: string       // FK → OrderLine
  status: 'pending' | 'done' | 'unavailable'
  actual_packs: number | null  // null для unavailable; quantity_packs для done
  updated_at: string
  user_id: string | null
}
```

**Как читать чеклист** (JOIN через Dexie):
```typescript
// Получить все entries чеклиста для сессии
const orderForSession = await db.orders.where('session_id').equals(sessionId).first()
const lines = await db.order_lines.where('order_id').equals(orderForSession.id).toArray()
const lineIds = lines.map(l => l.id)
const entries = await db.checklist_entries.where('order_line_id').anyOf(lineIds).toArray()
```

**Что НЕ сделано** в I-05 (задача I-06):
- `ChecklistPage` — только заглушка, нужна полная реализация с отметкой done/unavailable/взял меньше
- `SessionsPage` — только заглушка, нужен список активных + история
- `SessionDetailPage` — история одной сессии
- Добавить строку вручную в заявку из каталога

---

## Прочитай перед началом

**Спеки:**
- `docs/specs/S13-ui-request-checklist.md` — ВЕСЬ раздел "Экран чеклиста (fulfilling)": строки, отметка, undo, завершение сессии, PDF
- `docs/specs/S14-ui-navigation.md` — экран «Сессии»: активные вверху + история inline, карточки, кнопки по роли, блокировка нового обхода
- `docs/specs/S05-request.md` — переходы сессий, параллельные сессии (sweeping блокирует новый, fulfilling не блокирует)
- `docs/specs/S06-checklist.md` — статусы строк, actual_packs, завершение сессии
- `docs/specs/S08-history.md` — что показывается в деталях сессии (plan vs fact)
- `docs/specs/S00-design-system.md` — анимации (fade+slide 150ms для отметки), toast с прогресс-баром

**Код из предыдущих сессий:**
- `src/features/order/generateOrder.ts` — `updateSessionStatus()`
- `src/data/db.ts` — `db.sessions`, `db.orders`, `db.order_lines`, `db.checklist_entries`
- `src/data/store.ts` — `useAppStore()`: `userId`, `userRole`, `activeSessionId`, `setActiveSession()`
- `src/app/router.tsx` — маршруты `/app/checklist/:sessionId`, `/app/sessions`, `/app/session/:id`
- `src/features/sessions/SessionsPage.tsx` — заглушка, нужно заменить

**Скиллы для этой сессии:**
- Перед написанием компонентов: вызови `/ui-ux-pro-max`
- Если баг не решается за 2 попытки: вызови `/superpowers:systematic-debugging`
- В конце: `/superpowers:finishing-a-development-branch`, затем `/superpowers:verification-before-completion`

---

## Цель сессии

Сотрудник проходит полный flow до конца: отмечает позиции в чеклисте → сессия завершается → видна в истории на экране Сессий.

---

## Задачи

### 1. Чеклист: `src/features/checklist/ChecklistPage.tsx`

Маршрут: `/app/checklist/:sessionId`

```
←                              Чеклист   🖨

  Взято 3 из 8  ████████░░░░░░░░░
──────────────────────────────────────

  Брусок 50×50×3000             [Взял]
  4 пачки · 16 шт

  Доска 20×100×6000             [Взял]
  2 пачки · 8 шт

  ── Взятые и отсутствующие ──

  ✓  Труба ПВХ ⌀110×3000    Взял 3 пачки
  ✗  Штапик                 Нет на складе
```

Данные (цепочка JOIN через Dexie):
```typescript
const sessionId = useParams().sessionId
const order = useLiveQuery(() =>
  db.orders.where('session_id').equals(sessionId).first()
)
const orderLines = useLiveQuery(() =>
  order ? db.order_lines.where('order_id').equals(order.id).toArray() : []
, [order?.id])
const checklistEntries = useLiveQuery(() => {
  const lineIds = orderLines?.map(l => l.id) ?? []
  return lineIds.length > 0
    ? db.checklist_entries.where('order_line_id').anyOf(lineIds).toArray()
    : []
}, [orderLines])
```

Сортировка:
- `pending` строки — сверху, сортировка из S05 (материал → длина → имя)
- `done` и `unavailable` — в конец отдельным блоком

Sticky header "Взято N из M" (N = done + unavailable, M = все строки) — не скрывается при скролле.

Иконка 🖨 в header → `window.print()`.

### 2. Строка чеклиста: `src/features/checklist/ChecklistRow.tsx`

**Pending:**
```
┌────────────────────────────────────────┐
│  Брусок 50×50×3000          [Взял]     │
│  4 пачки · 16 шт                       │
└────────────────────────────────────────┘
```

Кнопка `[Взял]`: 56px высота, `--primary`, справа.

**Done:**
```
┌────────────────────────────────────────┐
│ ✓  Брусок 50×50×3000    Взял 4 пачки  │
│    4 пачки · 16 шт                     │
└────────────────────────────────────────┘
```
Фон: `rgba(16, 185, 129, 0.1)` (зелёный tint). Иконка Check (Lucide).

**Unavailable:**
```
┌────────────────────────────────────────┐
│ ✗  Брусок 50×50×3000    Нет на складе │
│    4 пачки · 16 шт                     │
└────────────────────────────────────────┘
```
Фон: `--muted`. Иконка X (Lucide).

### 3. Механизм отметки: `src/features/checklist/ChecklistActionSheet.tsx`

**Быстрая кнопка `[Взял]`** (один тап):
- `status = 'done'`, `actual_packs = quantity_packs`
- Анимация строки: `motion.div` fade + translateY(+20px), 150ms, затем уходит в конец списка
- Optimistic update: Dexie → Supabase

**Тап на строку (не на кнопку)** → bottom sheet:
```
Брусок 50×50×3000 · 4 пачки

[Взял всё           ]   ← зелёный #10B981
[Взял меньше...     ]   ← нейтральный
[Нет на складе      ]   ← muted
```

`[Взял меньше...]` → вложенный bottom sheet:
```
Брусок 50×50×3000

Сколько взял?
[−]  [ 4 ]  [+]    ← предзаполнено quantity_packs

              [Подтвердить]
```
Минимум 1, максимум quantity_packs. Прямой ввод числа тоже работает.

**Undo:** тап на `done` или `unavailable` строку → тот же bottom sheet. Пользователь выбирает новый статус.

### 4. Сохранение отметки: `src/features/checklist/saveChecklistEntry.ts`

```typescript
export async function saveChecklistEntry(
  entryId: string,
  update: { status: 'done' | 'unavailable' | 'pending'; actual_packs: number | null }
) {
  const now = new Date().toISOString()
  // Optimistic Dexie
  await db.checklist_entries.update(entryId, { ...update, updated_at: now })
  // Server
  const { error } = await supabase
    .from('checklist_entries')
    .update({ ...update, updated_at: now })
    .eq('id', entryId)
  if (error) {
    // Откат
    await db.checklist_entries.update(entryId, { /* предыдущее состояние */ })
    toast.error('Не сохранилось. Попробуйте ещё раз.')
    return
  }
  // Проверить завершение сессии
  await checkSessionCompletion(sessionId)
}
```

### 5. Автозавершение сессии: `checkSessionCompletion`

```typescript
async function checkSessionCompletion(sessionId: string) {
  const order = await db.orders.where('session_id').equals(sessionId).first()
  if (!order) return
  const lines = await db.order_lines.where('order_id').equals(order.id).toArray()
  const entries = await db.checklist_entries
    .where('order_line_id').anyOf(lines.map(l => l.id)).toArray()

  const allDone = entries.every(e => e.status === 'done' || e.status === 'unavailable')
  if (allDone && entries.length > 0) {
    await updateSessionStatus(sessionId, 'completed')
    // Toast (S13, S00): автозакрытие ~3 сек
    toast.success('✓ Все позиции отмечены')
    // НЕТ автоперехода на историю — пользователь остаётся на чеклисте
    // Переход к истории — через ← в header (navigate '/app/sessions')
  }
}
```

### 6. Прогресс-полоска в чеклисте

```typescript
const progress = entries.length > 0
  ? (entries.filter(e => e.status !== 'pending').length / entries.length) * 100
  : 0

// Полоска заполняется (не убывает)
<div style={{ width: `${progress}%`, background: 'var(--primary)' }} />
```

### 7. PDF-печать (кнопка 🖨)

```typescript
// В ChecklistPage:
// window.print() уже открывает диалог браузера
// CSS @media print — показывать только чеклист-таблицу
```

Создать `src/features/checklist/checklist-print.css`:
```css
@media print {
  .no-print { display: none; }
  .checklist-row { page-break-inside: avoid; }
}
```

Таблица печати: название товара, количество пачек, галочка "взял", крестик "нет на складе", "взял столько: ___".

### 8. Экран «Главная»: `src/features/home/HomePage.tsx`

Заменить заглушку на реальную реализацию. Это основной экран приложения — менеджер сессий + история. Маршрут: `/app/home`.

Данные:
```typescript
const sessions = useLiveQuery(() =>
  db.sessions.orderBy('started_at').reverse().toArray()
)
const profiles = useLiveQuery(() => db.user_profiles.toArray())
const { userId, userRole } = useAppStore()

// Активные: status in ['sweeping', 'ordering', 'fulfilling']
const activeSessions = sessions?.filter(s => ['sweeping', 'ordering', 'fulfilling'].includes(s.status)) ?? []
// История: status in ['completed', 'abandoned']
const historySessions = sessions?.filter(s => ['completed', 'abandoned'].includes(s.status)) ?? []
```

**Нет сессий:**
```
┌──────────────────────────────────┐
│ CELL                         ⚙️  │
│                                  │
│     Обходов пока нет             │
│                                  │
│      [Начать обход →]            │
└──────────────────────────────────┘
```

**Есть активные + история:**
```
┌──────────────────────────────────┐
│ CELL                         ⚙️  │
├──────────────────────────────────┤
│  [Карточка активной сессии]      │
│  [+ Начать новый обход]          │  ← заблокировано при sweeping/ordering
├─── История ──────────────────────┤
│  ✓ 4 июня  Завершена  12 позиций │
│  ✗ 28 мая  Брошена     —         │
└──────────────────────────────────┘
```

### 9. Карточка активной сессии: `src/features/sessions/SessionCard.tsx`

**Своя активная сессия (sweeping):**
```
┌──────────────────────────────────┐
│ 🔄  Обход · 3 июня               │
│ 23 из 45 ✓                       │
│ [Продолжить →]                   │
│                        Отменить  │  ← красный текст, muted, мелкий
└──────────────────────────────────┘
```

**Иконка по фазе:**
- sweeping: 🔄 (`RefreshCw` Lucide) + "Обход"
- ordering: 📝 (`FileText`) + "Заявка: черновик"
- fulfilling: 📋 (`ClipboardList`) + "Чеклист"

**Кнопка "Продолжить →"** → навигация по статусу (S14):
```typescript
function getContinueRoute(session: Session): string {
  switch (session.status) {
    case 'sweeping': return '/app/shelf'
    case 'ordering': return '/app/order'
    case 'fulfilling': return `/app/checklist/${session.id}`
    default: return '/app/sessions'
  }
}
```

**Чужой активный sweep** (employee):
```
┌──────────────────────────────────┐
│ 🔄  Иван ведёт обход             │
│ Начат 2 часа назад · 15/45       │
└──────────────────────────────────┘
```
Нет кнопок — только информация. Кнопка "Начать обход" заблокирована.

**Admin** на чужой сессии — дополнительно кнопка "[Завершить ×]" → abandon.

### 10. Начало нового обхода

Кнопка `[+ Начать новый обход]`:

```typescript
// Заблокирована если:
const hasSweepingOrOrdering = activeSessions.some(
  s => s.status === 'sweeping' || s.status === 'ordering'
)
// Подпись при блокировке: "Сначала завершите текущий обход"

// При нажатии (не заблокирована):
const sessionId = await startSweep(userId)
store.setActiveSession(sessionId)
store.setSessionMode(true)   // ← морфинг таббара в сессионный режим (S14)
navigate('/app/shelf')
```

**"Продолжить →" на карточке активной сессии:**

```typescript
function handleContinue(session: Session) {
  store.setSessionMode(true)   // ← таббар морфится
  switch (session.status) {
    case 'sweeping':   navigate('/app/shelf'); break
    case 'ordering':   navigate('/app/order'); break
    case 'fulfilling': navigate(`/app/checklist/${session.id}`); break
  }
}
```

Сессии в `fulfilling` НЕ блокируют новый обход (S05).

### 11. Отмена сессии

Кнопка "Отменить" на карточке активной сессии (деструктивная, красный текст, мелкая):

Dialog подтверждения:
```
Сессия будет отменена.
Введённые данные обхода сохранятся.

[Назад]    [Отменить сессию]
```

После подтверждения: `updateSessionStatus(session.id, 'abandoned')`.
Employee может отменить только свою; Admin — любую (S14).

### 12. Детали сессии: `src/features/sessions/SessionDetailPage.tsx`

Маршрут: `/app/session/:id` — тап на строку истории.

**Для completed:**
```
← Обход 4 июня

Товар              Заказали  Взяли   Статус
Брусок 50×50×3000    6 пачек   6     ✓
Доска 20×100×6000    4 пачки   3     частично
Труба ПВХ ⌀110×3000  2 пачки   —     нет на складе
```

**Для abandoned:** показывать что успели (остатки + незавершённая заявка если есть).

Данные: chain через `db.orders` → `db.order_lines` → `db.checklist_entries`.

### 13. Admin-агрегаты (заглушка на I-07)

В SessionsPage под историей — ссылки только для admin:
```typescript
{userRole === 'admin' && (
  <>
    <Button variant="outline" onClick={() => navigate('/app/admin/aggregates')}>
      Агрегаты по товарам →
    </Button>
    <Button variant="outline" onClick={exportExcel}>
      Экспорт Excel ↓
    </Button>
  </>
)}
```

`exportExcel` — заглушка ("I-07"), маршрут `/app/admin/aggregates` — заглушка.

---

## Не делать в этой сессии

- CatalogPage, ProductForm — I-07
- AuditPage, AuditLog — I-07
- Агрегаты по товарам полная реализация — I-07
- ExcelJS экспорт полная реализация — I-07
- PWA Service Worker, офлайн-индикатор полная реализация — I-08

---

## Результат

- [ ] `pnpm build` — 0 ошибок
- [ ] Полный flow: начать → внести → заявка → чеклист → завершение → история
- [ ] Кнопка `[Взял]` → строка анимируется вниз (150ms fade+slide)
- [ ] Тап на строку → bottom sheet: Взял всё / Взял меньше / Нет на складе
- [ ] "Взял меньше" → вложенный sheet с [−][N][+]
- [ ] Undo работает: повторный тап на done/unavailable → изменить статус
- [ ] После последней отметки: toast "✓ Все позиции отмечены", автозакрытие ~3 сек
- [ ] Сессия видна в истории с правильным статусом (✓ завершена / ✗ брошена)
- [ ] Тап на историю → детали сессии plan vs fact
- [ ] Кнопка "Начать обход" заблокирована при активном sweep/order
- [ ] Employee видит чужой sweep (без кнопок)
- [ ] Admin видит чужой sweep + кнопка "[Завершить ×]"
- [ ] "Отменить" сессию → Dialog → abandoned

---

## Инвентарь для I-07

Создать `docs/sessions/prompts/I-07-catalog-admin.md`.

**Что включить:**

1. **Компоненты `src/features/sessions/`, `src/features/checklist/`** — с экспортами
2. **`updateSessionStatus()`** — откуда импортировать
3. **`startSweep()`** — откуда импортировать
4. **Маршруты-заглушки**: `/app/admin/aggregates`, Excel экспорт — ждут I-07
5. **Что НЕ сделано**: CatalogPage, AuditPage — задача I-07
6. **Навигация из SessionsPage**: как добавить ссылку "Агрегаты" и Excel-кнопку (уже есть заглушки)
