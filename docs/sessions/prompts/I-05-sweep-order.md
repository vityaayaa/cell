# I-05 — Sweep + Order

## Контекст

I-01–I-04 завершены: domain-логика, data layer, навигация и ShelfGrid готовы. Admin видит стеллаж в edit-режиме, Employee видит стеллаж в view-режиме. Эта сессия — бизнес-логика обхода: начать сессию, вводить остатки, перейти к черновику заявки, редактировать и финализировать заявку.

---

## Прочитай перед началом

**Спеки:**
- `docs/specs/S04-stock-entry.md` — обход, ввод остатков, слепой пересчёт, прогресс
- `docs/specs/S05-request.md` — жизненный цикл сессии, генерация заявки, aggregation, формулы дефицита
- `docs/specs/S12-ui-stock-entry.md` — форма ввода: unit/round = числовое поле, bulk = слайдер, toast, переход к заявке
- `docs/specs/S13-ui-request-checklist.md` — черновик заявки: список строк, пограничные позиции, финализация (раздел "Экран черновика заявки")
- `docs/specs/S00-design-system.md` — токены, анимации, toast с прогресс-баром

**Код из предыдущих сессий:**
- `src/domain/request.ts` — `buildOrderLines()`, `calculateDeficitPacks()`, типы `CellStock`, `OrderLineInput`
- `src/domain/capacity.ts` — `getEffectiveCapacity()`, типы `ProductDimensions`, `CellDimensions`
- `src/data/db.ts` — `db.sessions`, `db.stock_entries`, `db.orders`, `db.order_lines`, `db.cells`, `db.products`
- `src/data/supabase.ts` — supabase клиент
- `src/data/store.ts` — `useAppStore()`: `activeSessionId`, `setActiveSession()`, `userRole`, `isSessionMode`, `setSessionMode(v)`
- `src/features/shelf/ShelfPage.tsx` — компонент ShelfPage, ожидает данные о прогрессе обхода
- `src/features/shelf/ShelfGrid.tsx` — ShelfGrid с `mode="view"`, callback `onLeafTap: (cell: Cell) => void`
- `src/app/router.tsx` — маршруты `/app/shelf`, `/app/order`

**Скиллы для этой сессии:**
- Перед написанием компонентов: вызови `/ui-ux-pro-max`
- Если баг не решается за 2 попытки: вызови `/superpowers:systematic-debugging`
- В конце: `/superpowers:finishing-a-development-branch`, затем `/superpowers:verification-before-completion`

---

## Цель сессии

Полный flow обхода: начать → вводить остатки → видеть прогресс → перейти к заявке → редактировать → финализировать. `pnpm build` без ошибок.

---

## Задачи

### 1. Slider shadcn: установить компонент

```bash
pnpm dlx shadcn@latest add slider
```

### 2. Начало обхода: `src/features/sessions/startSweep.ts`

```typescript
export async function startSweep(userId: string): Promise<string> {
  // Создать Session запись
  const session = {
    id: crypto.randomUUID(),
    user_id: userId,
    started_at: new Date().toISOString(),
    finished_at: null,
    status: 'sweeping' as const,
    updated_at: new Date().toISOString(),
  }
  // Optimistic: Dexie
  await db.sessions.put(session)
  // Server
  const { error } = await supabase.from('sessions').insert(session)
  if (error) {
    await db.sessions.delete(session.id)
    throw error
  }
  return session.id
}
```

### 3. Прогресс обхода: `src/features/shelf/useSweepProgress.ts`

```typescript
export function useSweepProgress(sessionId: string | null) {
  // M = листовые ячейки с product_id (из db.cells)
  // N = уникальные cell_id в db.stock_entries где session_id = sessionId
  // visitedCellIds: Set<string> — для подсветки в ShelfGrid
  return { visited: number, total: number, visitedCellIds: Set<string> }
}
```

### 4. Sticky прогресс-бар: `src/features/shelf/SweepProgressBar.tsx`

```
Обход: 12 из 45 ✓                              [→ К заявке]
```

- Всегда видна над сеткой, не скрывается при скролле (`position: sticky; top: 0; z-index: 10`)
- "→ К заявке": кнопка 48px, `--primary`

При нажатии "→ К заявке":
```typescript
async function handleGoToOrder() {
  if (visited / total < 0.5) {
    // Показать Dialog подтверждения
    const confirmed = await showConfirmDialog(
      `Внесено только ${visited} из ${total} ячеек. Продолжить к заявке?`
    )
    if (!confirmed) return
  }
  // СНАЧАЛА создать заявку, ПОТОМ навигировать
  await generateOrder(activeSessionId)
  navigate('/app/order')
}
```

`generateOrder` из `src/features/order/generateOrder.ts` (задача 7 этой сессии) — создаёт Order + OrderLines + меняет статус на `ordering`. Без этого OrderDraftPage откроется с пустыми данными.

### 5. Обновить `ShelfPage` (убрать заглушку прогресс-бара)

```typescript
// src/features/shelf/ShelfPage.tsx
const { activeSessionId } = useAppStore()
const { visited, total, visitedCellIds } = useSweepProgress(activeSessionId)

// Передать в ShelfGrid:
<ShelfGrid
  mode="view"
  sessionId={activeSessionId}
  visitedCellIds={visitedCellIds}
  onLeafTap={(cell) => navigate(`/app/stock-entry/${cell.id}`)}
/>
```

Также: добавить маршрут `/app/stock-entry/:cellId` в router.tsx.

### 6. Форма ввода остатка: `src/features/stock/StockEntryPage.tsx`

Маршрут: `/app/stock-entry/:cellId`

**Для unit и round:**
```
← A2(1,1)

Брусок 50×50×3000
Вместимость: 50 шт

[ __ ] шт

        [Сохранить]
```

- `inputMode="numeric"`, шрифт 16px (iOS Safari zoom)
- Поле пустое при открытии (слепой пересчёт, S04)
- Валидация: value > capacity → подсветить `--destructive`, кнопка заблокирована + "Максимум N шт"
- Пустое → кнопка заблокирована

**Для bulk:**
```
← A2(1,2)

Штапик
Вместимость: 8 пачек

○────────────────○   ← shadcn Slider, min=0, max=100, step=1
        ≈ 4 пачки    ← round(fill% / 100 × capacity_packs)

        [Сохранить]
```

- Слайдер начинается с 0 (слепой пересчёт)
- Подпись обновляется в реальном времени

**После сохранения:**

```typescript
async function saveStockEntry(cellId: string, value: number) {
  const entry = {
    id: crypto.randomUUID(),
    cell_id: cellId,
    session_id: activeSessionId,
    user_id: userId,
    value,   // S04: поле называется value, не quantity
    created_at: new Date().toISOString(),
  }
  // Optimistic write в Dexie
  await db.stock_entries.put(entry)
  // Server
  const { error } = await supabase.from('stock_entries').insert(entry)
  if (error) {
    await db.stock_entries.delete(entry.id)
    toast.error('Не сохранилось. Попробуйте ещё раз.')
    return
  }
  // Toast успеха (S12, S00: с прогресс-баром)
  // "✓ Внесено: 49 из 50 шт" для unit/round
  // "✓ Внесено: ≈ 4 из 8 пачек (50%)" для bulk
  navigate(-1) // вернуться к стеллажу
}
```

Toast: shadcn Sonner (`toast.success(...)`), с убывающим прогресс-баром через Motion (`--progress-bar`).

**Realtime-защита (S12):**
```typescript
useEffect(() => {
  const ch = subscribeToTable('cells', (payload) => {
    if (payload.new?.id === cellId && payload.eventType === 'UPDATE') {
      // Если изменились размеры товара → закрыть форму
      toast('Параметры ячейки изменились. Откройте снова.')
      navigate(-1)
    }
  })
  return () => supabase.removeChannel(ch)
}, [cellId])
```

### 7. Генерация заявки при переходе к ordering

Создать `src/features/order/generateOrder.ts`:

```typescript
export async function generateOrder(sessionId: string): Promise<string> {
  // 1. Собрать актуальные остатки: последний StockEntry на каждую ячейку в сессии
  const entries = await db.stock_entries
    .where('session_id').equals(sessionId)
    .sortBy('created_at')

  // Для каждой ячейки — только последняя запись
  const latestByCell = new Map<string, StockEntry>()
  for (const e of entries) latestByCell.set(e.cell_id, e)

  // 2. Построить CellStock[]
  const cellStocks: CellStock[] = []
  for (const [cellId, entry] of latestByCell) {
    const cell = await db.cells.get(cellId)
    if (!cell?.product_id) continue
    const product = await db.products.get(cell.product_id)
    if (!product) continue
    const capacity = getEffectiveCapacity(cell, product, {
      rotation_allowed: cell.rotation_allowed,
      capacity_override: cell.capacity_override,
    })
    cellStocks.push({
      cell_id: cellId,
      product_id: product.id,
      product_type: product.type,
      pack_size: product.pack_size,
      capacity,
      current_stock: entry.value,
    })
  }

  // 3. Вызвать domain-функцию
  const orderLines = buildOrderLines(cellStocks)

  // 4. Создать Order + OrderLines
  const orderId = crypto.randomUUID()
  const order = { id: orderId, session_id: sessionId, created_at: new Date().toISOString(), finalized_at: null, updated_at: new Date().toISOString() }

  // await внутри map — невалидно, нужен Promise.all
  const lines = await Promise.all(orderLines.map(async (l) => ({
    id: crypto.randomUUID(),
    order_id: orderId,
    product_id: l.product_id,
    product_name: await getProductDisplayName(l.product_id), // S08: снимок имени
    quantity_packs: l.quantity_packs,
    quantity_units: l.quantity_units,
    deficit_units: l.deficit_units,
    is_manual: false,
    is_boundary: l.is_boundary,
    updated_at: new Date().toISOString(),
  })))

  // Optimistic write + server
  await db.orders.put(order)
  await db.order_lines.bulkPut(lines)
  await supabase.from('orders').insert(order)
  await supabase.from('order_lines').insert(lines)

  // 5. Обновить статус сессии
  await updateSessionStatus(sessionId, 'ordering')

  return orderId
}

async function getProductDisplayName(productId: string): Promise<string> {
  const p = await db.products.get(productId)
  if (!p) return 'Неизвестный товар'
  if (p.type === 'unit') return `${p.name} ${p.width_mm}×${p.height_mm}×${p.length_mm}`
  if (p.type === 'round') return `${p.name} ⌀${p.diameter_mm}×${p.length_mm}`
  return p.name
}
```

Функция `updateSessionStatus`:
```typescript
export async function updateSessionStatus(sessionId: string, status: Session['status']) {
  const now = new Date().toISOString()
  await db.sessions.update(sessionId, { status, updated_at: now })
  await supabase.from('sessions').update({ status, updated_at: now }).eq('id', sessionId)
  if (status === 'abandoned' || status === 'completed') {
    await db.sessions.update(sessionId, { finished_at: now })
    await supabase.from('sessions').update({ finished_at: now }).eq('id', sessionId)
  }
}
```

### 8. Черновик заявки: `src/features/order/OrderDraftPage.tsx`

Маршрут: `/app/order`

**Кнопки "← К обходу" — НЕТ.** Навигация на стеллаж происходит через вкладку "Стеллаж" в таббаре (S14). Статус сессии при этом не меняется.

```
                               Заявка

────────────────────────────────────────────
  Брусок 50×50×3000          4 пачки · 16 шт
  Доска 20×100×6000           2 пачки · 8 шт
  Труба ПВХ ⌀110×3000         3 пачки · 6 шт

────────────────────────────────────────────
  Пограничные позиции
  Штапик                 дефицит 3 шт < пачки
  Плинтус 30×10×3000     дефицит 2 шт < пачки

────────────────────────────────────────────

              [Финализировать заявку]
```

Данные:
```typescript
const { activeSessionId } = useAppStore()
const order = useLiveQuery(() =>
  db.orders.where('session_id').equals(activeSessionId ?? '').first()
)
const allLines = useLiveQuery(() =>
  order ? db.order_lines.where('order_id').equals(order.id).toArray() : []
, [order?.id])
const mainLines = allLines?.filter(l => !l.is_boundary) ?? []
const boundaryLines = allLines?.filter(l => l.is_boundary) ?? []
```

Сортировка строк: материал-приоритет → длина убывает → имя А→Я (S05).
Навигация назад на стеллаж — через вкладку "Стеллаж" в таббаре (S14). Статус остаётся `ordering`.

### 9. Bottom sheet строки заявки: `src/features/order/OrderLineSheet.tsx`

Открывается при тапе на строку основного списка:

```
Брусок 50×50×3000
Дефицит: 30 шт · расчётное 2 пачки

[−]  [ 2 ]  [+]
              [Сохранить]

────────────────────────
[Удалить из заявки]
```

- Предзаполнено `quantity_packs`
- Сохранить: `supabase.from('order_lines').update({ quantity_packs, quantity_units: quantity_packs * pack_size })` + Dexie optimistic
- Удалить: `supabase.from('order_lines').delete().eq('id', lineId)` + `db.order_lines.delete(lineId)`

### 10. Bottom sheet пограничной позиции

Тап на строку в "Пограничные позиции":

```
Штапик
дефицит 3 шт — меньше одной пачки (4 шт)

[Включить в заявку]
```

"Включить": `supabase.from('order_lines').update({ is_boundary: false, quantity_packs: 1 })` + открыть OrderLineSheet для редактирования.

### 11. Финализация заявки

Кнопка "Финализировать заявку" (48px, менее заметная) → bottom sheet:

```
Готово к финализации

8 позиций · 24 пачки

Это нельзя отменить. Заявка будет зафиксирована.

[Отмена]          [Финализировать →]
```

"Финализировать →" (56px, `--primary`):
```typescript
async function finalizeOrder(orderId: string, sessionId: string) {
  const now = new Date().toISOString()
  // Залочить заявку
  await db.orders.update(orderId, { finalized_at: now })
  await supabase.from('orders').update({ finalized_at: now }).eq('id', orderId)

  // Создать ChecklistEntries из OrderLines
  const lines = await db.order_lines.where('order_id').equals(orderId).toArray()
  const checklistEntries = lines.map(l => ({
    id: crypto.randomUUID(),
    order_line_id: l.id,
    status: 'pending' as const,
    actual_packs: null,
    updated_at: now,
    user_id: userId,
  }))
  await db.checklist_entries.bulkPut(checklistEntries)
  await supabase.from('checklist_entries').insert(checklistEntries)

  // Сменить статус сессии
  await updateSessionStatus(sessionId, 'fulfilling')

  navigate(`/app/checklist/${sessionId}`)
}
```

---

## Не делать в этой сессии

- ChecklistPage (UI чеклиста) — I-06
- SessionsPage (список сессий) — I-06
- Добавить строку вручную в заявку (добавить товар из каталога) — I-06
- ExcelJS экспорт — I-07
- PDF-печать чеклиста — I-06

---

## Результат

- [ ] `pnpm build` — 0 ошибок TypeScript
- [ ] `pnpm test` — тесты зелёные
- [ ] Начать обход → создаётся Session в sweeping
- [ ] Тап на ячейку в view-режиме → форма ввода
- [ ] Форма unit: числовой ввод, валидация > capacity
- [ ] Форма bulk: слайдер, подпись "≈ N пачек" в реальном времени
- [ ] После сохранения: toast с прогресс-баром, ячейка обновляется (✓ зелёный)
- [ ] Прогресс-бар "N из M" обновляется после каждого ввода
- [ ] "→ К заявке" при < 50% → предупреждение; при ≥ 50% → сразу заявка
- [ ] OrderDraftPage показывает основные + пограничные строки
- [ ] Тап на строку → sheet редактирования количества
- [ ] Финализация → создаются ChecklistEntries → navigate к чеклисту

---

## Инвентарь для I-06

Добавить инвентарь в `docs/sessions/prompts/I-06-checklist-sessions.md` (файл уже существует — не перезаписывать, только добавить раздел `### Создано в I-05 (инвентарь)`).

**Что включить:**

1. **Файлы `src/features/stock/`, `src/features/order/`** — с ключевыми функциями/компонентами
2. **`updateSessionStatus()`** — точная сигнатура, импорт
3. **`generateOrder()`** — откуда импортировать
4. **Маршрут `/app/checklist/:sessionId`** — что ожидает ChecklistPage (sessionId)
5. **Структура ChecklistEntry** — поля `status`, `actual_packs`, `updated_at`, `user_id`
6. **Как читать чеклист**: JOIN через `order_lines` → `order_line_id` → `order_id` → `session_id`
7. **Что НЕ сделано**: сама ChecklistPage — задача I-06
