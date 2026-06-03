# I-01 — Setup + Domain Core

## Контекст

Первая сессия реализации. Предыдущих сессий нет.
Спецификация полностью готова (S00–S14 в docs/specs/).
Задача: инициализировать проект и реализовать всю доменную логику как чистые TypeScript-функции.

Следующая сессия (I-02) будет создавать Supabase-схему и data layer — ей понадобятся TypeScript-типы из этой сессии.

## Прочитай перед началом

**Спеки:**
- docs/specs/S00-design-system.md — цвета, шрифты, токены (для CSS-переменных)
- docs/specs/S01-catalog.md — типы товаров (unit/round/bulk), pack_size, формула отображения имени
- docs/specs/S02-shelf-model.md — BSP-дерево, таблица Cell, computed_mm
- docs/specs/S03-capacity.md — формула вместимости, поворот 90°, rotation_allowed
- docs/specs/S05-request.md — формула дефицита (unit vs bulk), агрегация, пограничные позиции
- docs/specs/S10-stack.md — стек (версии пакетов), структура папок

**CLAUDE.md** — правила работы в проекте.

**Скиллы для этой сессии:**
- Перед реализацией domain-функций (capacity, bsp, request): вызови `/superpowers:test-driven-development` — сначала тест, потом код. Формулы вместимости и дефицита критичны, ошибка даёт неверную заявку.
- Перед закрытием сессии: вызови `/superpowers:verification-before-completion`

## Цель сессии

Инициализированный проект со всей доменной логикой: `pnpm test` зелёный, `pnpm dev` запускается.

---

## Задачи

### 1. Инициализация проекта

```bash
pnpm create vite@latest cell --template react-ts
cd cell
```

Перед установкой пакетов: проверить актуальные версии через Context7 (`react`, `typescript`, `tailwindcss`, `vite`, `framer-motion` / `motion`, `react-router`, `zustand`, `@supabase/supabase-js`, `dexie`, `dexie-react-hooks`, `react-hook-form`, `zod`, `vitest`, `@testing-library/react`). Версии из S10 — ориентир, но могут устареть.

Установить и настроить:
- **Tailwind CSS v4** (новый способ через `@tailwindcss/vite`)
- **shadcn/ui** — `pnpm dlx shadcn@latest init` (выбрать нейтральный base color, остальное переопределим через CSS vars)
  - Добавить компоненты: Button, Input, Label, Slider, Badge, Separator, Sheet, Dialog, Toast (Sonner или shadcn toast)
- **Motion** (проверить: пакет называется `motion` или `framer-motion` в v12 — уточнить через Context7)
- **React Router v7** (SPA-режим, без SSR)
- **Zustand v5**
- **react-hook-form v7 + zod v4 + @hookform/resolvers**
- **Vitest v4 + @testing-library/react + jsdom** (настроить в `vite.config.ts`)

### 2. Структура папок

Создать пустые папки согласно S10:

```
src/
├── app/            # маршруты, провайдеры, ролевые оболочки, onboarding
├── domain/         # чистая логика: capacity, BSP, request (+тесты рядом)
├── data/           # Dexie, Supabase client, синхронизация, offline-очередь
├── features/       # экраны: catalog, shelf, stock, order, checklist, sessions, admin
├── ui/             # компоненты shadcn/ui + свои, анимации
└── lib/            # утилиты: форматирование, экспорт Excel, даты
```

Создать `src/lib/utils.ts` (shadcn добавит сам) и `src/lib/types.ts` для глобальных типов (пока пустой).

### 3. Тема и CSS-переменные

Создать `src/app/themes.css` (или настроить в `src/index.css`) с CSS-переменными из S00:

```css
/* Три темы: .light (default), .dark, .oled */
:root, [data-theme="light"] {
  --background: #F8FAFC;
  --card: #FFFFFF;
  --foreground: #0F172A;
  --muted-foreground: #64748B;
  --muted: #F1F5F9;
  --border: #E2E8F0;
  --primary: #F97316;
  --primary-foreground: #FFFFFF;
  --destructive: #EF4444;
  --destructive-foreground: #FFFFFF;
  --ring: #F97316;
}

[data-theme="dark"] { /* значения из S00 */ }
[data-theme="oled"] { /* значения из S00 */ }
```

Применять тему через `data-theme` атрибут на `<html>`. Настроить Tailwind чтобы использовал эти CSS-переменные (`--primary → hsl(...)` или hex — как настроит shadcn).

Шрифт Inter: подключить через Google Fonts или `fontsource`.

### 4. Domain: capacity.ts

Создать `src/domain/capacity.ts`.

**Типы:**

```typescript
export type ProductType = 'unit' | 'round' | 'bulk'

export interface CellDimensions {
  computed_width_mm: number
  computed_height_mm: number
}

export interface UnitProductDimensions {
  type: 'unit'
  width_mm: number
  height_mm: number
}

export interface RoundProductDimensions {
  type: 'round'
  diameter_mm: number
}

export interface BulkProductDimensions {
  type: 'bulk'
}

export type ProductDimensions = UnitProductDimensions | RoundProductDimensions | BulkProductDimensions
```

**Функции:**

`calculateBaseCapacity(cell: CellDimensions, product: UnitProductDimensions): number`
- `floor(cell.computed_width_mm / product.width_mm) * floor(cell.computed_height_mm / product.height_mm)`
- Если cell или product имеет нулевые размеры — вернуть 0

`calculateRotatedCapacity(cell: CellDimensions, product: UnitProductDimensions): number`
- Остаток ширины: `cell.computed_width_mm % product.width_mm`
- Если `remaining_width >= product.height_mm` → `floor(remaining_width / product.height_mm) * floor(cell.computed_height_mm / product.width_mm)`
- Иначе → 0

`getEffectiveCapacity(cell: CellDimensions, product: ProductDimensions, options: { rotation_allowed: boolean; capacity_override: number | null }): number`
- Если `capacity_override !== null` → вернуть `capacity_override`
- Для `unit`: `calculateBaseCapacity + (rotation_allowed && width !== height ? calculateRotatedCapacity : 0)`
- Для `round` и `bulk`: 0 (вместимость всегда вводится вручную — capacity_override обязателен; если null, возвращать 0)

### 5. Domain: bsp.ts

Создать `src/domain/bsp.ts`.

**Типы:**

```typescript
export type SplitDirection = 'H' | 'V'

export interface BspNode {
  id: string
  parent_id: string | null
  split_direction: SplitDirection | null  // null = не сплитована
  is_first_child: boolean | null          // null для корневых
  // физические размеры (только у корневых)
  width_mm?: number
  height_mm?: number
  // вычисленные (у всех)
  computed_width_mm: number
  computed_height_mm: number
}
```

**Функции:**

`computeChildDimensions(parent: BspNode, direction: SplitDirection, isFirstChild: boolean): { computed_width_mm: number; computed_height_mm: number }`
- V-сплит: оба ребёнка `width = floor(parent.computed_width_mm / 2)`, `height = parent.computed_height_mm`
- H-сплит: оба ребёнка `width = parent.computed_width_mm`, `height = floor(parent.computed_height_mm / 2)`

`recomputeDescendants(nodes: BspNode[]): BspNode[]`
- Принимает полный список узлов одного дерева (одной базовой ячейки)
- Возвращает новый массив с пересчитанными `computed_*` для всех узлов
- Алгоритм: найти корень (parent_id = null), обойти BFS, на каждом уровне пересчитать через `computeChildDimensions`

`isLeaf(nodeId: string, allNodes: BspNode[]): boolean`
- Вернуть `true` если нет детей (ни одного node с `parent_id === nodeId`)

`getLeafNodes(nodes: BspNode[]): BspNode[]`
- Вернуть все листовые узлы

### 6. Domain: request.ts

Создать `src/domain/request.ts`.

**Типы:**

```typescript
export interface CellStock {
  cell_id: string
  product_id: string
  product_type: ProductType
  pack_size: number
  capacity: number        // для unit/round: штуки; для bulk: пачки
  current_stock: number   // для unit/round: штуки; для bulk: пачки
}

export interface OrderLineInput {
  product_id: string
  quantity_packs: number
  quantity_units: number  // quantity_packs * pack_size
  deficit_units: number | null  // null для bulk
  is_boundary: boolean
  is_manual: false
}
```

**Функции:**

`calculateDeficitPacks(stock: CellStock): { deficit: number; full_packs: number; is_boundary: boolean }`

Для `unit` и `round`:
```
deficit_units = capacity - current_stock
full_packs = floor(deficit_units / pack_size)
is_boundary = full_packs === 0 && deficit_units > 0
```

Для `bulk`:
```
deficit_packs = capacity - current_stock  // оба уже в пачках
full_packs = deficit_packs
is_boundary = false  // для bulk дробных пачек нет
```

`aggregateByProduct(cells: CellStock[]): Map<string, CellStock[]>`
- Группировать по product_id

`buildOrderLines(cells: CellStock[]): OrderLineInput[]`
- Агрегировать по продукту (суммировать дефициты по всем ячейкам с этим товаром)
- Применить формулу к суммарному дефициту
- Отбросить full_packs === 0 И not boundary
- Вернуть массив отсортированный: сначала non-boundary, потом boundary
- Для bulk: `deficit_units = null` в результирующей строке

### 7. Тесты

Создать тесты рядом с файлами (*.test.ts) — Vitest.

**`capacity.test.ts` — минимум 8 тестов:**
- Базовый кейс: ячейка 545×400, товар 50×40 → 100 шт
- Поворот влезает: ячейка 545×400, товар 50×40 → 108 шт (100 + 8 повёрнутых)
- Поворот не влезает (остаток < высоте товара) → только базовые
- Квадратный товар (width === height): rotation_allowed = true, но поворот не даёт прибавки → правильный результат
- rotation_allowed = false: поворот игнорируется
- capacity_override = 50 → всегда 50, игнорирует расчёт
- Нулевые размеры → 0
- bulk тип → 0 если override = null

**`bsp.test.ts` — минимум 6 тестов:**
- V-сплит ячейки 545×400: оба ребёнка 272×400
- H-сплит ячейки 545×400: оба ребёнка 545×200
- Глубина 2: V-сплит 545×400, потом H-сплит правого ребёнка → три листа с правильными размерами
- isLeaf: корень с детьми → false; лист → true
- getLeafNodes: дерево с 3 листами → 3 результата
- recomputeDescendants: после изменения корня пересчитывает все потомки

**`request.test.ts` — минимум 8 тестов:**
- unit: capacity=50, stock=40, pack_size=10 → full_packs=1, not boundary
- unit boundary: capacity=50, stock=47, pack_size=10 → full_packs=0, is_boundary=true
- unit full: capacity=50, stock=50 → full_packs=0, not boundary, не попадает в заявку
- bulk: capacity_packs=8, stock_packs=4 → full_packs=4
- bulk full: capacity_packs=8, stock_packs=8 → full_packs=0, не в заявке
- Агрегация: один товар в 2 ячейках, дефицит 7+6=13, pack_size=10 → 1 пачка (не 0+0)
- buildOrderLines: non-boundary идут первыми, boundary в конце
- buildOrderLines: товар с full=0 и not boundary — не включается

### 8. Заглушка app/main.tsx

Убедиться что `pnpm dev` запускается без ошибок. Допускается пустой экран с текстом "CELL" — не нужно реализовывать UI в этой сессии.

---

## Не делать в этой сессии

- React-компоненты (ShelfGrid, формы, экраны) — это I-03, I-04, I-05
- Supabase клиент, Dexie схема — это I-02
- Навигация, роли, auth — это I-03
- Конкретные значения pack_size, размеры тестовых товаров можно брать любые разумные

---

## Результат

По завершении сессии:
- [ ] `pnpm test` — все тесты зелёные (≥ 22 теста)
- [ ] `pnpm build` — сборка без ошибок TypeScript
- [ ] `pnpm dev` — запускается без ошибок
- [ ] CSS-переменные трёх тем заданы
- [ ] Структура папок `src/` создана

---

## В конце этой сессии: написать промпт I-02

Прочитай `docs/sessions/PROMPT-GUIDE.md` — там шаблон и правила.

Создать файл `docs/sessions/prompts/I-02-backend.md`.

**Что обязательно включить в I-02:**

1. **Инвентарь файлов и экспортов этой сессии:**
   - Полный список файлов в `src/domain/`
   - Все экспортируемые типы (особенно `CellDimensions`, `ProductDimensions`, `CellStock`, `OrderLineInput`, `BspNode`)
   - Все экспортируемые функции с сигнатурами
   - Какая версия TypeScript используется (`tsconfig.json` target)

2. **Конфигурация проекта:**
   - Версии ключевых пакетов которые реально установлены (из `package.json`)
   - Настройка path aliases (если добавил `@/` → `src/`)
   - Как запускать тесты (`pnpm test`, `pnpm test:watch`)

3. **Решения отличающиеся от спек:**
   - Любые изменения относительно S02/S03/S05 (например, типы данных, округление)

4. **Что нужно I-02:**
   - I-02 будет создавать Supabase-таблицы — типы из domain/ должны совпадать с полями таблиц
   - Особо важно: `CellDimensions` → поля таблицы `cells`; `OrderLineInput` → поля `order_lines`
   - I-02 будет писать Dexie-схему — она должна зеркалить Supabase-таблицы

5. **Что не сделано** из плана этой сессии (если что-то не влезло)

**Контекст для I-02:** I-02 создаёт всё что касается хранения и синхронизации данных:
Supabase migrations (SQL), RLS политики, Edge Functions, Dexie схему, слой синхронизации.
Это backend-сессия — никаких React-компонентов.
