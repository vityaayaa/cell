# I-04 — Shelf Builder

## Контекст

I-01–I-03 завершены: domain-логика, data layer и навигационные оболочки готовы. Приложение входит в аккаунт, показывает правильный layout по роли. Эта сессия — визуальный компонент стеллажа (`ShelfGrid`) в двух режимах: `edit` (для admin на `/app/shelf-config`) и `view` (для employee/admin во время обхода на `/app/shelf`).

---

### Создано в I-03 (инвентарь)

**`src/app/AppShell.tsx`** — `export function AppShell()`. Auth guard: isLoading → skeleton, no session → `/login`, ok → `<Outlet />`. Вызывает `initialLoad()` при монтировании, слушает `online`/`offline`.

**`src/app/AppLayout.tsx`** — `export function AppLayout()`. Layout-маршрут (рендерит `<Outlet />`). Header 56px с `OfflineIndicator` и ⚙️ (employee → bottom sheet, admin → `/app/settings`). BottomNav 64px снизу.

**`src/app/BottomNav.tsx`** — `export function BottomNav()`. Морфинг через `motion/react AnimatePresence` (spring 250ms). Режимы: `home-employee` → 1 вкладка, `home-admin` → 3 вкладки, `session` → 4 вкладки. Читает `isSessionMode` из store. Тап "Главная" в session → `setSessionMode(false)`.

**`src/app/ThemeProvider.tsx`** — `export function ThemeProvider()`, `export function useTheme()`. Хранит тему в `localStorage('cell-theme')`, применяет `data-theme` на `document.documentElement`.

**`src/app/useAuth.ts`** — `export function useAuth()` → `{ session: AuthSession|null, userProfile: UserProfile|null, isLoading: boolean }`. Слушает `onAuthStateChange`, пишет профиль в Dexie и store.

**`src/app/SettingsBottomSheet.tsx`** — `export function SettingsBottomSheet({ open, onClose })`. Для employee: тема + выйти.

**`src/features/auth/LoginPage.tsx`** — react-hook-form + zodResolver (zod v4 работает), sonner toast, `mapError()` → русский текст.

**`src/features/auth/OnboardingPage.tsx`** — вызывает `supabase.functions.invoke('create-first-admin', { body: {} })` для проверки, затем форму.

**`src/features/admin/SettingsPage.tsx`** — полноэкранный (без AppLayout), `export default SettingsPage`.

**`src/features/admin/UsersPage.tsx`** — useLiveQuery + Dialog + optimistic block/unblock.

**Заглушки** (уже созданы, заменить в I-04):
- `src/features/shelf/ShelfPage.tsx` — `export default ShelfPage`
- `src/features/shelf/ShelfConfigPage.tsx` — `export default ShelfConfigPage`

**Ключевые решения:**
- Настройки (admin) — вне `AppLayout` (без header/BottomNav): структура router `/app` → AppShell → `<Outlet>`, где AppLayout — отдельный layout-маршрут только для основных экранов.
- `setSessionMode(true)` + navigate → морфинг таббара в сессионный режим. Вызывать при "Начать обход" / "Продолжить →".
- `clearUser()` в store также сбрасывает `isSessionMode = false`.
- `order_lines` теперь имеет поле `product_name TEXT DEFAULT ''` (migration 005 применена).
- `supabase.functions.invoke()` — правильный способ вызова Edge Functions из клиента.

**Команды:**
- `pnpm build` — 0 ошибок TypeScript ✓
- `pnpm test` — 28 тестов зелёных ✓

---

## Прочитай перед началом

**Спеки:**
- `docs/specs/S11-ui-shelf-builder.md` — ГЛАВНАЯ. Вся визуальная логика стеллажа: ячейки, drill-down, флаги, edit/view режим
- `docs/specs/S02-shelf-model.md` — BSP-дерево, структура Cell, computed_mm
- `docs/specs/S03-capacity.md` — formulas вместимости, флаг needs_review, capacity_override
- `docs/specs/S01-catalog.md` — тип товара (unit/round/bulk), Material.color для tint
- `docs/specs/S00-design-system.md` — токены цветов, анимации 150–250ms, touch targets ≥ 64px

**Код из предыдущих сессий:**
- `src/domain/capacity.ts` — `getEffectiveCapacity`, типы `ProductDimensions`, `CellDimensions`
- `src/domain/bsp.ts` — `BspNode`, `computeChildDimensions`, `recomputeDescendants`, `isLeaf`, `getLeafNodes`
- `src/data/db.ts` — `db.cells`, `db.products`, `db.materials`, `db.shelves`; типы `Cell`, `Product`, `Material`, `Shelf`
- `src/data/supabase.ts` — `supabase` клиент
- `src/data/sync.ts` — `subscribeToTable()`
- `src/data/store.ts` — `useAppStore()`: `userRole`, `isOnline`, `isSessionMode`, `setSessionMode(v: boolean)`
- `src/app/router.tsx` — маршруты `/app/shelf` (view) и `/app/shelf-config` (admin, обёрнут в `AdminGuard`)

**Скиллы для этой сессии:**
- Перед написанием компонентов: вызови `/ui-ux-pro-max` (shadcn/ui, Tailwind v4, CSS Grid для BSP)
- Если баг не решается за 2 попытки: вызови `/superpowers:systematic-debugging`
- В конце: `/superpowers:finishing-a-development-branch`, затем `/superpowers:verification-before-completion`

---

## Цель сессии

Admin видит стеллаж в edit-режиме на `/app/shelf-config` (сплит, мерж, настройки, назначение товара). Employee/Admin на `/app/shelf` видит стеллаж в view-режиме (тап → переход к вводу остатка, но сама форма ввода — в I-05).

---

## Архитектура компонента ShelfGrid

Один компонент, два режима:

```typescript
interface ShelfGridProps {
  mode: 'edit' | 'view'
}
```

- `edit` → действия по тапу на ячейку открывают bottom sheet с операциями (сплит, мерж, назначить товар и т.д.)
- `view` → тап на листовую ячейку → `navigate('/app/stock-entry/:cellId')` (заглушка в этой сессии)

---

## Задачи

### 1. Данные: загрузка и Realtime

Создать `src/features/shelf/useShelfData.ts`:

```typescript
export function useShelfData() {
  // Читает shelf (первый и единственный) из Dexie
  const shelf = useLiveQuery(() => db.shelves.toArray().then(s => s[0]))
  // Все ячейки стеллажа
  const cells = useLiveQuery(() =>
    shelf ? db.cells.where('shelf_id').equals(shelf.id).toArray() : []
  , [shelf?.id])
  // Все продукты (для имён и tint)
  const products = useLiveQuery(() => db.products.toArray())
  // Все материалы (для цветов)
  const materials = useLiveQuery(() => db.materials.toArray())

  return { shelf, cells, products, materials }
}
```

Realtime-подписка (в `ShelfPage` и `ShelfConfigPage`):
```typescript
useEffect(() => {
  const channel = subscribeToTable('cells', async (payload) => {
    if (payload.eventType === 'DELETE') {
      await db.cells.delete(payload.old.id)
    } else {
      await db.cells.put(payload.new)
    }
  })
  return () => supabase.removeChannel(channel)
}, [])
```

### 2. Начальная настройка стеллажа: `src/features/shelf/ShelfSetupPage.tsx`

Показывается на `/app/shelf-config` если `shelf === undefined`:

```
Стеллаж ещё не настроен

Рядов:    [ 4 ]
Столбцов: [ 6 ]

[Создать →]
```

При сабмите: создать строки Shelf + N×M строк Cell в Supabase → optimistic write в Dexie → reload.

Новые ячейки: `parent_id = null`, `row_index` и `col_index` из сетки, `computed_width_mm = 0`, `computed_height_mm = 0` (пока нет физических размеров).

### 3. Level 1 — Обзор стеллажа: `src/features/shelf/ShelfGrid.tsx`

```
← Стеллаж (или ← A2 при drill-down)

┌─────┬─────┬─────┬─────┬─────┬─────┐
│ A1  │ A2  │ A3  │ A4  │ A5  │ A6  │
├─────┼─────┼─────┼─────┼─────┼─────┤
│ B1  │ B2  │ B3  │ B4  │ B5  │ B6  │
└─────┴─────┴─────┴─────┴─────┴─────┘
```

- Двунаправленный скролл: `overflow: auto` на контейнере
- Минимальная ширина ячейки: 64px (S11)
- Горизонтальный формат ячеек (шире, чем высокие)
- При наличии drill-down header показывает адрес текущего уровня + ← (назад)

Реализация через CSS Grid:
```typescript
const style = {
  gridTemplateColumns: `repeat(${shelf.cols_count}, minmax(64px, 1fr))`,
  gridTemplateRows: `repeat(${shelf.rows_count}, 72px)`,
}
```

### 4. Ячейка стеллажа: `src/features/shelf/CellCard.tsx`

```typescript
interface CellCardProps {
  cell: Cell
  allCells: Cell[]
  products: Product[]
  materials: Material[]
  mode: 'edit' | 'view'
  sessionId?: string        // для отображения прогресса обхода
  visitedCellIds?: Set<string> // внесённые ячейки в этом обходе
  onTap: (cell: Cell) => void
}
```

**Несплитованная ячейка (isLeaf):**
```
┌──────────────────────────────┐
│ A1                        ⚠  │  ← адрес 12px muted + флаги top-right
│                              │
│  Брусок 50×50×3000           │  ← название 16px, по центру
│                              │
│  3 дня назад                 │  ← дата 12px muted; "✓ Внесено сегодня" если visited
└──────────────────────────────┘
```

Фон: `hexToRgba(material.color, 0.1)` если есть товар; `--muted` если нет.

**Сплитованная ячейка (!isLeaf):**
```
┌──────────────────────────────┐
│ A2                        ⚠  │
│  ● Брусок 50×50×3000         │  ← точки цветов материалов + названия
│  ● Труба ПВХ ⌀110×3000       │
│  1 из 3 ✓               →   │  ← прогресс + стрелка drill-down
└──────────────────────────────┘
```

Стрелка → всегда показывается у сплитованной ячейки.

**Адрес ячейки:**
- Корневая: `A1`, `B3` (из row_index/col_index: строки = A/B/C..., столбцы = 1/2/3...)
- Суб-ячейка: передаётся через пропы (строится при drill-down)

**Флаги (top-right, Lucide иконки):**

| Флаг | Иконка | Цвет | Условие |
|------|--------|------|---------|
| needs_review | `AlertTriangle` | `#F59E0B` | `cell.needs_review = true` |
| rotation off | `RotateCcwSquare` | `--muted-foreground` | `cell.rotation_allowed = false` |
| manual capacity | `Pencil` | `--muted-foreground` | `cell.capacity_override != null` |

Приоритет показа: needs_review → rotation off → manual capacity. Показывается только приоритетный.

**Дата:**
- `sessionId` передан + cell.id в `visitedCellIds` → "✓ Внесено сегодня" (зелёный `#10B981`)
- Иначе → дата последнего `stock_entries` для этой ячейки (читать через useLiveQuery или передавать как проп)
- Никогда не вносилось → "Не вносилось" muted

### 5. Drill-down: `src/features/shelf/ShelfLevelView.tsx`

```typescript
interface ShelfLevelViewProps {
  parentCell: Cell        // ячейка, в которую drill-down
  allCells: Cell[]        // все ячейки стеллажа
  mode: 'edit' | 'view'
  // ... другие пропы
}
```

Рендерит потомков `parentCell`: `cells.filter(c => c.parent_id === parentCell.id)`.

CSS Grid для BSP:
```typescript
// V-сплит: левая/правая половины
gridTemplateColumns: 'repeat(2, 1fr)'  // для двух дочерних при V-сплите
// H-сплит: верхняя/нижняя половины
gridTemplateRows: 'repeat(2, 1fr)'     // для двух дочерних при H-сплите
```

Рекурсия: тап на сплитованную суб-ячейку → `ShelfLevelView` для её потомков.
Header: ← (вернуться на уровень выше) + адрес текущей ячейки.

Реализация через стек адресов: `const [addressStack, setAddressStack] = useState<Cell[]>([])`.

### 6. Взаимодействия edit-режим: `src/features/shelf/CellActionsSheet.tsx`

Bottom sheet, открывается при тапе на ячейку в edit-режиме.

**Листовая без товара:**
```
[Назначить товар                         ]
[ Разделить →  ]    [ Разделить ↓       ]
[Настройки ячейки                        ]
```

**Листовая с товаром:**
```
[Сменить товар                           ]
[Убрать товар                            ]  ← красный текст
─────────────────────────────────────────
[ Разделить →  ]    [ Разделить ↓       ]
[Объединить с A2(1,2)                    ]  ← только если есть BSP-сосед
[Настройки ячейки                        ]
```

**Сплитованная (в L1):**
```
[Открыть ячейку →                        ]
[Размеры базовой ячейки                  ]  ← только корневые
```

Все кнопки: 56px, shadcn `Button`.

### 7. Операции edit-режим

**Сплит:**
```typescript
async function splitCell(cell: Cell, direction: 'H' | 'V') {
  const child1 = { id: crypto.randomUUID(), parent_id: cell.id, is_first_child: true, split_direction: direction, ...computeChildDimensions(cell, direction, true), shelf_id: cell.shelf_id, row_index: cell.row_index, col_index: cell.col_index }
  const child2 = { ...child1, id: crypto.randomUUID(), is_first_child: false, ...computeChildDimensions(cell, direction, false) }
  const updatedCell = { ...cell, split_direction: direction, product_id: null } // нелистовая — без товара

  // Оптимистично в Dexie
  await db.transaction('rw', [db.cells], async () => {
    await db.cells.put(updatedCell)
    await db.cells.bulkPut([child1, child2])
  })

  // На сервер
  await supabase.from('cells').upsert([updatedCell, child1, child2])
  // При ошибке: откат + toast "Не сохранилось. Попробуйте ещё раз."
}
```

**Мерж (объединить с соседом):**
- Сосед = другой потомок того же `parent_id` (всегда один в BSP)
- Родитель становится листом: убрать обоих потомков, очистить `split_direction` у родителя
- Если у соседа есть товар: показать предупреждающий Dialog перед удалением

**Назначить товар:**
- Открывает список товаров из `db.products` (shadcn `Sheet` с поиском)
- После выбора: `supabase.from('cells').update({ product_id }).eq('id', cellId)` + Dexie optimistic
- Сбрасывает `capacity_override` (S03)

**Убрать товар:** просто `product_id = null`.

### 8. `src/features/shelf/CellSettingsPage.tsx`

Экран `/app/shelf-config/cell/:cellId` (или modal, реши сам):

```
← Настройки A2(1,1)

Вместимость
  Расчётная: 108 шт          ← только если unit + есть размеры
  Переопределение: [     ]   ← numeric input, пусто = по формуле

Поворот                      ← только unit с width ≠ height
  [●─────────────] Разрешён

Размеры ячейки               ← только корневые (parent_id IS NULL)
  Ширина: [ 545 ] мм
  Высота:  [ 400 ] мм
```

Расчётная вместимость: `getEffectiveCapacity(cell, product, { rotation_allowed: cell.rotation_allowed, capacity_override: null })`.

После изменения размеров базовой ячейки: пересчитать `computed_*` всех потомков через `recomputeDescendants()` + сохранить.

### 9. Обработка флага needs_review (edit-режим)

Тап на ⚠ флаг → Dialog:

```
Требует проверки

Размеры товара изменились. Проверьте вместимость ячейки.

[Открыть настройки]    [Всё в порядке ✓]
```

"Всё в порядке ✓": `supabase.from('cells').update({ needs_review: false }).eq('id', cellId)` + Dexie.

### 10. Реализация экранов

**`src/features/shelf/ShelfConfigPage.tsx`** (admin, `/app/shelf-config`):
- Если нет Shelf → `<ShelfSetupPage />`
- Иначе → `<ShelfGrid mode="edit" />`
- Заголовок: "🏪 Стеллаж" + кнопка ⚙ (manage shelf actions: добавить строку/столбец)

**`src/features/shelf/ShelfPage.tsx`** (все роли, `/app/shelf`, только в sweeping):
- `<ShelfGrid mode="view" />`
- Заголовок: "Стеллаж" + ← (назад к Сессиям)
- Sticky progress bar: "Обход: N из M ✓ [→ К заявке]" — **заглушка** в этой сессии, данные придут из I-05

---

## Не делать в этой сессии

- StockEntryForm (форма ввода остатков при тапе на ячейку в view-режиме) — I-05
- Логика "начать обход" (создание Session, кнопки на экране Сессий) — I-05/I-06
- SweepProgressBar с реальными данными — I-05
- Полная реализация SessionsPage — I-06
- Форма создания/редактирования товара в каталоге — I-07

---

## Результат

- [ ] `pnpm build` — 0 ошибок
- [ ] `pnpm test` — 28+ тестов зелёные
- [ ] Admin видит пустую сетку N×M на `/app/shelf-config`
- [ ] Тап на ячейку в edit-режиме → bottom sheet с операциями
- [ ] Сплит ячейки → две суб-ячейки появляются (визуально и в Dexie)
- [ ] Drill-down в сплитованную ячейку → следующий уровень
- [ ] Назначение товара на ячейку → имя и tint появляются
- [ ] Флаги (needs_review, rotation, override) отображаются
- [ ] Employee видит стеллаж в view-режиме на `/app/shelf` (тап на ячейку → toast "I-05")
- [ ] Realtime: если admin меняет стеллаж, employee видит изменение без перезагрузки

---

## Инвентарь для I-05

Добавить инвентарь в `docs/sessions/prompts/I-05-sweep-order.md`.

**Что включить:**

1. **Компоненты `src/features/shelf/`**: ShelfGrid, CellCard, CellActionsSheet — с пропами
2. **Как передать sessionId в ShelfGrid**: для отображения прогресса обхода
3. **Как определить листовые ячейки**: `isLeaf(cellId, allCells)` из domain/bsp.ts
4. **Маршрут тапа на ячейку в view-режиме**: что сейчас делает заглушка, что нужно заменить
5. **Realtime канал**: как подписан, как отписаться при unmount
6. **Что изменилось в ShelfPage**: какие пропы ожидает SweepProgressBar
7. **Что НЕ сделано**: StockEntryForm — задача I-05
