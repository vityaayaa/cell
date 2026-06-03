# I-02 — Backend (Supabase + Data Layer)

## Контекст

I-01 завершена: проект инициализирован, вся доменная логика написана и покрыта тестами (28 тестов, всё зелёное). Этот промпт — бэкенд-сессия: Supabase-схема, RLS-политики, Edge Functions, Dexie-витрина, слой синхронизации. Никаких React-компонентов.

---

## Прочитай перед началом

**Спеки (читать все — только они):**
- `docs/specs/S01-catalog.md` — модели Product и Material
- `docs/specs/S02-shelf-model.md` — модели Shelf и Cell (BSP-дерево)
- `docs/specs/S03-capacity.md` — поле `capacity_override`, `rotation_allowed`, `needs_review`
- `docs/specs/S04-stock-entry.md` — модель StockEntry (ссылается на session_id, не sweep)
- `docs/specs/S05-request.md` — Session, Order, OrderLine, ChecklistEntry
- `docs/specs/S06-checklist.md` — статусы ChecklistEntry
- `docs/specs/S07-roles.md` — роли admin/employee, invite-процесс Supabase Auth
- `docs/specs/S09-offline-sync.md` — online-first, Dexie-витрина, LWW, offline-очередь, Realtime
- `docs/specs/S10-stack.md` — архитектура модулей, `src/data/` структура

**Код из I-01 (читай эти файлы):**
- `src/domain/capacity.ts` — типы `ProductType`, `CellDimensions`, `ProductDimensions`
- `src/domain/bsp.ts` — тип `BspNode`, `SplitDirection`
- `src/domain/request.ts` — типы `CellStock`, `OrderLineInput`
- `package.json` — реально установленные версии пакетов
- `tsconfig.app.json` — TypeScript конфигурация (важно: нет `baseUrl`)
- `vite.config.ts` — алиас `@/` → `src/`
- `components.json` — shadcn конфигурация

**Скиллы для этой сессии:**
- Если баг не решается за 2 попытки: вызови `/superpowers:systematic-debugging`
- В конце сессии: вызови `/superpowers:finishing-a-development-branch`, затем `/superpowers:verification-before-completion`

---

## Цель сессии

Рабочий data layer: Supabase-миграции применены, Dexie-схема зеркалирует БД, базовая синхронизация (загрузка каталога при старте) работает.

---

## Задачи

### 1. Supabase: создание проекта (если ещё нет)

Использовать Supabase MCP для:
- Получить список существующих проектов (`list_projects`)
- Если проекта нет — создать через `create_project`
- Записать `project_id`, `project_url`, `anon_key` — они понадобятся для `.env.local`

Создать файл `.env.local` в корне проекта:
```
VITE_SUPABASE_URL=<project_url>
VITE_SUPABASE_ANON_KEY=<anon_key>
```

### 2. Supabase: SQL-миграции

Создать файлы в `supabase/migrations/` и применить через `mcp__claude_ai_Supabase__apply_migration`.

**Порядок миграций (зависимости!)**:

```
001_initial_schema.sql    — материалы, продукты, стеллаж, ячейки
002_sessions.sql          — сессии, остатки, заявки, чеклист
003_rls.sql               — все RLS-политики
004_triggers.sql          — updated_at триггеры + аудит-лог
```

**Инварианты схемы из спек:**
- Все таблицы имеют `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- Все редактируемые таблицы: `updated_at timestamptz NOT NULL DEFAULT now()`
- `updated_at` обновляется автоматически через триггер (паттерн: `BEFORE UPDATE` на каждой таблице)
- Клиент создаёт UUID до отправки (идемпотентность офлайн-очереди)
- Таблица `cells` — единая для корневых узлов BSP и всех потомков

**Ключевые таблицы (подробности в спеках):**

| Таблица | Основные поля | Спека |
|---------|---------------|-------|
| `materials` | id, name, color hex, is_custom | S01 |
| `products` | id, name, type enum, material_id, pack_size, width_mm, height_mm, length_mm, diameter_mm | S01 |
| `shelves` | id, name, rows_count, cols_count | S02 |
| `cells` | id, shelf_id, parent_id→cells, split_direction H/V, is_first_child bool, row_index, col_index, width_mm, height_mm, computed_width_mm, computed_height_mm, product_id→products, capacity_override int, rotation_allowed bool, needs_review bool | S02+S03 |
| `sessions` | id, user_id→auth.users, started_at, finished_at, status enum | S05 |
| `stock_entries` | id, session_id→sessions, cell_id→cells, quantity int, created_at | S04 |
| `orders` | id, session_id→sessions, created_at, finalized_at | S05 |
| `order_lines` | id, order_id→orders, product_id→products, quantity_packs, quantity_units, deficit_units int nullable, is_manual bool, is_boundary bool | S05 |
| `checklist_entries` | id, order_line_id→order_lines, status enum pending/done/unavailable, updated_at, user_id→auth.users | S05+S06 |
| `audit_log` | id, table_name, record_id, operation, old_data jsonb, new_data jsonb, user_id, created_at | S07/S08 |

### 3. RLS-политики

Все RLS включены. Правила из S07:

- `materials`, `products`, `shelves`, `cells`: читает любой аутентифицированный; пишет только admin
- `sessions`, `stock_entries`: читает и пишет владелец (`user_id = auth.uid()`); admin читает всё
- `orders`, `order_lines`, `checklist_entries`: читает и пишет владелец сессии; admin читает всё
- `audit_log`: только admin (SELECT), никто не INSERT напрямую (только триггеры)

Проверить роль через `user_metadata.role = 'admin'` или через отдельную таблицу `user_profiles`. Выбрать подход согласно S07.

### 4. Edge Functions

Создать в `supabase/functions/`:
- `create-user/index.ts` — только для admin; создаёт пользователя через `supabase.auth.admin.createUser()`; возвращает ошибку если вызывающий не admin
- `create-first-admin/index.ts` — одноразовая функция (работает только если в системе нет ни одного пользователя); создаёт первого admin

Развернуть через `mcp__claude_ai_Supabase__deploy_edge_function`.

### 5. Dexie-схема

Создать `src/data/db.ts`.

Dexie v4 с TypeScript:

```typescript
import Dexie, { type EntityTable } from 'dexie'
// Типы из domain/ — не дублировать, импортировать!
```

Таблицы в Dexie зеркалируют таблицы Supabase. Индексы:
- Все `id` — primaryKey
- Внешние ключи как индексы: `&product_id`, `&session_id`, `&cell_id`
- `cells`: индекс по `shelf_id`, по `parent_id`

Также создать таблицу `sync_queue` — офлайн-очередь:
```typescript
interface SyncQueueItem {
  id: string           // uuid, клиент создаёт
  table_name: string
  record_id: string
  operation: 'upsert' | 'delete'
  payload: object
  created_at: string
}
```

### 6. Supabase-клиент

Создать `src/data/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

Создать `src/data/database.types.ts` — TypeScript-типы из Supabase через MCP:
`mcp__claude_ai_Supabase__generate_typescript_types` → вставить результат в файл.

### 7. Слой синхронизации (базовый)

Создать `src/data/sync.ts` с функциями:

```typescript
// Загрузить при старте: каталог и стеллаж (без сессий — они тяжёлые)
export async function initialLoad(): Promise<void>

// Подписка на Realtime-изменения таблицы
export function subscribeToTable(
  table: string,
  onChanged: (payload: RealtimePayload) => void,
): RealtimeChannel

// Отправить операцию из sync_queue на сервер
export async function flushQueue(): Promise<void>

// Проверка связи (простой fetch к Supabase)
export async function checkOnline(): Promise<boolean>
```

**Стратегия из S09:**
- `initialLoad()` при старте приложения: грузит `materials`, `products`, `shelves`, `cells` в Dexie
- Пишет в Dexie, UI читает из Dexie через `useLiveQuery` (Dexie = витрина)
- `flushQueue()` вызывается при восстановлении связи
- LWW: при получении Realtime-события сравнить `updated_at` — записать если сервер новее

### 8. Zustand: ui-состояние

Создать `src/data/store.ts`:

```typescript
interface AppStore {
  // Сетевой статус
  isOnline: boolean
  isSyncing: boolean
  syncQueueLength: number

  // Текущий пользователь
  userId: string | null
  userRole: 'admin' | 'employee' | null

  // Активная сессия
  activeSessionId: string | null

  // Экшены
  setOnline: (v: boolean) => void
  setUser: (id: string, role: 'admin' | 'employee') => void
  setActiveSession: (id: string | null) => void
}
```

---

## Не делать в этой сессии

- React-компоненты (LoginForm, AppShell, BottomNav) — это I-03
- Realtime-подписки на таблицы сессий/остатков — это I-05 (при запуске обхода)
- Logika регистрации первого пользователя (onboarding UI) — это I-03
- Supabase Storage (если нет фото товаров в v1 — не нужно)

---

## Результат

По завершении сессии:
- [ ] SQL-миграции применены к Supabase (`list_tables` показывает все таблицы)
- [ ] `src/data/db.ts` — Dexie-схема создана
- [ ] `src/data/supabase.ts` — клиент создан
- [ ] `src/data/database.types.ts` — TypeScript-типы из Supabase
- [ ] `src/data/sync.ts` — базовые функции синхронизации
- [ ] `src/data/store.ts` — Zustand store
- [ ] `.env.local` создан (не коммитить!)
- [ ] `pnpm build` — сборка без ошибок TypeScript
- [ ] Edge Functions задеплоены (проверить через `list_edge_functions`)

---

## Инвентарь I-01 — что создано

### src/domain/capacity.ts
```typescript
export type ProductType = 'unit' | 'round' | 'bulk'
export interface CellDimensions { computed_width_mm: number; computed_height_mm: number }
export interface UnitProductDimensions { type: 'unit'; width_mm: number; height_mm: number }
export interface RoundProductDimensions { type: 'round'; diameter_mm: number }
export interface BulkProductDimensions { type: 'bulk' }
export type ProductDimensions = UnitProductDimensions | RoundProductDimensions | BulkProductDimensions
export function calculateBaseCapacity(cell: CellDimensions, product: UnitProductDimensions): number
export function calculateRotatedCapacity(cell: CellDimensions, product: UnitProductDimensions): number
export function getEffectiveCapacity(
  cell: CellDimensions,
  product: ProductDimensions,
  options: { rotation_allowed: boolean; capacity_override: number | null }
): number
```

### src/domain/bsp.ts
```typescript
export type SplitDirection = 'H' | 'V'
export interface BspNode {
  id: string; parent_id: string | null
  split_direction: SplitDirection | null; is_first_child: boolean | null
  width_mm?: number; height_mm?: number
  computed_width_mm: number; computed_height_mm: number
}
export function computeChildDimensions(parent: BspNode, direction: SplitDirection, isFirstChild: boolean): { computed_width_mm: number; computed_height_mm: number }
export function recomputeDescendants(nodes: BspNode[]): BspNode[]
export function isLeaf(nodeId: string, allNodes: BspNode[]): boolean
export function getLeafNodes(nodes: BspNode[]): BspNode[]
```

### src/domain/request.ts
```typescript
export interface CellStock {
  cell_id: string; product_id: string; product_type: ProductType
  pack_size: number; capacity: number; current_stock: number
}
export interface OrderLineInput {
  product_id: string; quantity_packs: number; quantity_units: number
  deficit_units: number | null; is_boundary: boolean; is_manual: false
}
export function calculateDeficitPacks(stock: CellStock): { deficit: number; full_packs: number; is_boundary: boolean }
export function aggregateByProduct(cells: CellStock[]): Map<string, CellStock[]>
export function buildOrderLines(cells: CellStock[]): OrderLineInput[]
```

### Ключевое маппинг: domain-типы → таблицы БД

| Domain тип | БД-таблица | Примечание |
|------------|-----------|-----------|
| `CellDimensions` | `cells` | `computed_width_mm`, `computed_height_mm` — кэш в БД |
| `BspNode` | `cells` | Та же таблица: и корневые, и суб-ячейки |
| `ProductDimensions` | `products` | `type` — enum `unit`/`round`/`bulk` |
| `CellStock` | НЕ таблица | Вычисляемый JOIN: `cells` + `products` + последний `stock_entries` |
| `OrderLineInput` | `order_lines` | `deficit_units nullable`, `is_manual`, `is_boundary` |

### Конфигурация проекта

**Реально установленные версии (из pnpm-lock):**
- `typescript`: 6.0.3
- `vite`: 8.0.16
- `react`: 19.2.7
- `@supabase/supabase-js`: 2.107.0
- `dexie`: 4.4.3
- `dexie-react-hooks`: 4.4.0
- `zustand`: 5.0.14
- `zod`: 4.4.3
- `motion`: 12.40.0
- `react-router`: 7.16.0
- `vitest`: 4.1.8

**Path alias**: `@/` → `src/` (в `vite.config.ts`)
```typescript
resolve: { alias: { '@': path.resolve(__dirname, './src') } }
```
**ВАЖНО**: в `tsconfig.app.json` нет `baseUrl` (устарел в TS6). Только `paths: { "@/*": ["./src/*"] }`.

**Команды:**
- `pnpm dev` — dev-сервер на `:5173`
- `pnpm build` — typecheck + vite build
- `pnpm typecheck` — только TypeScript
- `pnpm test` — vitest run (28 тестов)
- `pnpm test:watch` — vitest watch

**shadcn/ui**: настроен, `components.json` в корне. Компоненты в `src/components/ui/`:
- button, input, label, badge, separator, sheet, dialog — уже установлены
- slider — ещё нет (нужен в I-05)

### Решения отличающиеся от спек

1. **`number` вместо `integer`** — TypeScript не различает, все числовые поля `number`. В SQL — правильные типы (`integer`, `real`).
2. **`baseUrl` убран из tsconfig** — TypeScript 6 объявил его устаревшим. `paths` без `baseUrl` работает в `moduleResolution: "bundler"`.
3. **shadcn в `src/components/ui/`** — стандартная shadcn-локация, а не `src/ui/` как в S10. `src/ui/` используется для собственных компонентов и анимаций.
4. **`CellStock` — не таблица БД** — это JOIN-тип для domain-логики. В БД хранятся отдельные таблицы `cells`, `products`, `stock_entries`.

### Что НЕ сделано в I-01

- Supabase клиент — задача I-02 ✓
- Dexie-схема — задача I-02 ✓
- Auth и навигация — задача I-03
- React-компоненты — задача I-03 и далее
- Slider shadcn-компонент — нужен в I-05

---

## В конце этой сессии: написать промпт I-03

Прочитай `docs/sessions/PROMPT-GUIDE.md`.

Создать `docs/sessions/prompts/I-03-auth-shell.md`.

**Что обязательно включить в I-03:**

1. **Inвентарь src/data/**: все файлы с экспортами (`supabase`, `db`, типы из `database.types.ts`, `AppStore`)
2. **Supabase project ref** и URL (нужны I-03 для авторизации)
3. **Как проверить роль пользователя** — из `user_metadata` или из `user_profiles` (зависит от реализации I-02)
4. **Dexie-таблицы** — список с именами чтобы I-03 знал что читать через `useLiveQuery`
5. **Edge Function URLs** — `create-user` и `create-first-admin` для вызова из UI
6. **Что нужно I-03**: маршрутизация (React Router), LoginForm, ролевые оболочки (AdminShell / EmployeeShell), BottomNav, онбординг первого запуска
