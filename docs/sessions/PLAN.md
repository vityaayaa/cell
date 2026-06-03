# CELL — План сессий

## Фаза 0 — Спецификация (завершена)

| # | Тема | Спека |
|---|------|-------|
| S00 | Дизайн-система | docs/specs/S00-design-system.md |
| S01 | Каталог товаров | docs/specs/S01-catalog.md |
| S02 | Модель стеллажа | docs/specs/S02-shelf-model.md |
| S03 | Расчёт вместимости | docs/specs/S03-capacity.md |
| S04 | Внесение остатков | docs/specs/S04-stock-entry.md |
| S05 | Заявка на склад | docs/specs/S05-request.md |
| S06 | Чеклист | docs/specs/S06-checklist.md |
| S07 | Роли и доступ | docs/specs/S07-roles.md |
| S08 | История | docs/specs/S08-history.md |
| S09 | Офлайн и синхронизация | docs/specs/S09-offline-sync.md |
| S10 | Стек и архитектура | docs/specs/S10-stack.md |
| S11 | UI: Конструктор стеллажа | docs/specs/S11-ui-shelf-builder.md |
| S12 | UI: Внесение остатков | docs/specs/S12-ui-stock-entry.md |
| S13 | UI: Заявка и чеклист | docs/specs/S13-ui-request-checklist.md |
| S14 | UI: Общий UX и навигация | docs/specs/S14-ui-navigation.md |

---

## Фаза 1 — Реализация

Каждая сессия — отдельный чат. Перед началом **обязательно прочитать CLAUDE.md** и все спеки из раздела "Читать".

---

### I-01 — Инициализация проекта

**Цель:** рабочий dev-сервер с правильной структурой папок, shadcn/ui и базовым PWA-манифестом.

**Читать:** S00, S10

**Сделать:**
- Инициализировать проект: `pnpm create vite cell --template react-ts`
- Настроить Tailwind CSS v4 + shadcn/ui (init, добавить базовые компоненты)
- Подключить Motion v12, React Router v7 (SPA-режим), Zustand v5
- Настроить `vite-plugin-pwa` (манифест, иконки — без SW-логики)
- Настроить Vitest v4 + `@testing-library/react`
- Создать структуру папок: `src/app`, `src/domain`, `src/data`, `src/features`, `src/ui`, `src/lib`
- Создать `src/lib/tokens.css` с CSS-переменными из S00 (три темы: light/dark/OLED)
- Заглушка экрана логина (без backend)
- Убедиться что `pnpm dev`, `pnpm build`, `pnpm test` работают

**Результат:** пустой, но рабочий проект с правильным стеком.

---

### I-02 — Supabase: схема БД

**Цель:** все таблицы, RLS-политики, триггеры и Edge Functions созданы в Supabase.

**Читать:** S01, S02, S03, S04, S05, S06, S07, S09, S10

**Сделать:**

*Таблицы (в `supabase/migrations/001_schema.sql`):*
- `materials` (id, name, color, is_custom, created_at, updated_at)
- `products` (id, name, type, material_id, pack_size, width_mm, height_mm, length_mm, diameter_mm, created_at, updated_at)
- `shelves` (id, name, rows_count, cols_count, created_at, updated_at)
- `cells` (id, shelf_id, parent_id, split_direction, is_first_child, row_index, col_index, width_mm, height_mm, computed_width_mm, computed_height_mm, product_id, capacity_override, rotation_allowed, needs_review, created_at, updated_at)
- `user_profiles` (id FK→auth.users, name, role, is_active, created_by, created_at, updated_at)
- `sessions` (id, user_id, started_at, finished_at, status, created_at, updated_at)
- `stock_entries` (id, cell_id, session_id, user_id, value, created_at)
- `orders` (id, session_id, created_at, finalized_at, updated_at)
- `order_lines` (id, order_id, product_id, product_name, quantity_packs, quantity_units, deficit_units, is_manual, is_boundary, created_at, updated_at)
- `checklist_entries` (id, order_line_id, status, actual_packs, user_id, updated_at)
- `audit_log` (id, actor_id, event_type, entity_type, entity_id, old_value, new_value, created_at)

*Автоматические `updated_at` (trigger на каждой таблице кроме stock_entries и audit_log)*

*RLS-политики (в `supabase/migrations/002_rls.sql`):*
- `user_profiles`: read — authenticated; write — service_role (Edge Functions)
- `materials`, `products`, `shelves`, `cells`: read — authenticated; write — admin only
- `sessions`, `stock_entries`, `orders`, `order_lines`, `checklist_entries`: read — authenticated; write — authenticated (с проверкой session ownership где нужно)
- `audit_log`: read — admin only; insert — service_role (триггеры)

*DB-триггеры (в `supabase/migrations/003_triggers.sql`):*
- Триггер аудит-лога на все значимые таблицы (INSERT/UPDATE/DELETE)

*Edge Functions (в `supabase/functions/`):*
- `create-first-admin`: без авторизации; создаёт первого admin если таблица user_profiles пуста; использует service_key
- `create-user`: только admin; создаёт Supabase Auth user + user_profile + отправляет invite
- `delete-user`: только admin; удаляет из auth + деактивирует профиль

**Результат:** полная рабочая схема в Supabase, проверенная через Supabase dashboard.

---

### I-03 — Domain Core (чистая логика + тесты)

**Цель:** все бизнес-расчёты как чистые TypeScript-функции с полным покрытием тестами.

**Читать:** S01, S02, S03, S05

**Сделать** (в `src/domain/`):

*`capacity.ts` — расчёт вместимости (S03):*
- `calculateCapacity(cell, product): number` — базовая формула для `unit`
- `calculateCapacityWithRotation(cell, product): number` — с поворотом 90°
- `getEffectiveCapacity(cell, product): number` — с учётом capacity_override

*`bsp.ts` — BSP-дерево (S02):*
- `splitCell(cell, direction): [Cell, Cell]` — создаёт двух потомков
- `mergeCells(child1, child2): Cell` — объединяет siblings
- `computeDimensions(cell, ancestors): {width, height}` — пересчёт computed_mm
- `isLeaf(cell, allCells): boolean`
- `getLeafCells(rootCell, allCells): Cell[]`

*`request.ts` — расчёт заявки (S05):*
- `calculateDeficit(capacity, stock, type): number` — для unit/round и bulk
- `aggregateDeficits(cells, stockEntries, products): Map<productId, deficitUnits>`
- `buildOrderLines(deficits, products): OrderLine[]` — включая пограничные позиции
- `isBoundary(deficitUnits, packSize): boolean`

*`*.test.ts` рядом с каждым файлом — тесты для:*
- Вместимость: базовый кейс, поворот влезает / не влезает, квадратный товар, capacity_override
- BSP: сплит, мерж, глубина 3, пересчёт dimensions
- Заявка: unit формула, bulk формула, агрегация нескольких ячеек, пограничная позиция, empty order

**Результат:** `pnpm test` проходит зелёным, все формулы покрыты.

---

### I-04 — Data Layer (Dexie + синхронизация)

**Цель:** локальная витрина IndexedDB + полный цикл синхронизации с Supabase.

**Читать:** S09, S10

**Сделать** (в `src/data/`):

*`db.ts` — Dexie-схема:* все таблицы из S09 (products, materials, cells, sessions, stock_entries, orders, order_lines, checklist_entries, sync_queue)

*`supabase.ts` — клиент Supabase:* инициализация с env-переменными

*`sync.ts` — слой синхронизации:*
- `initialLoad()`: загрузка всех данных из Supabase → bulkPut в Dexie
- `subscribeRealtime()`: подписки на таблицы (products, materials, cells, sessions, checklist_entries); echo-дедупликация по ID/updated_at
- `unsubscribeRealtime()`

*`write.ts` — запись с rollback:*
- `writeOnline<T>(table, operation, payload): Promise<void>` — оптимистичное обновление Dexie → Supabase → rollback при ошибке

*`queue.ts` — офлайн-очередь:*
- `enqueue(table, operation, payload)`: добавить в sync_queue + оптимистично обновить Dexie
- `processQueue()`: обработать очередь по порядку при появлении связи (idempotent upsert)

*`connectivity.ts` — определение связи:*
- `checkConnectivity(): Promise<boolean>` — ping к Supabase health endpoint
- `useConnectivity()` — хук с состояниями online/offline/syncing + счётчик очереди

**Результат:** слой данных работает изолированно, синхронизация проверена вручную.

---

### I-05 — Auth + App Shell

**Цель:** рабочий логин, onboarding первого admin, навигация по ролям, тема.

**Читать:** S00, S07, S14

**Сделать** (в `src/app/`, `src/features/auth/`):

*Auth:*
- Экран входа (email + password, валидация через Zod, react-hook-form)
- "Забыл пароль?" → Supabase password reset
- Onboarding первого admin (вызов `create-first-admin` Edge Function; показывается только если нет ни одного admin)
- `useAuth()` хук: текущий пользователь, роль, logout
- Route guards: неавторизованным → `/login`; неправильная роль → redirect

*Навигация:*
- Employee shell: главный экран = Сессии (заглушка), ⚙️ bottom sheet (тема + logout)
- Admin shell: 3 таба (Сессии, Каталог, Стеллаж) + ⚙️ icon → экран Настройки (заглушка)
- Правильный stack-навигатор для каждой вкладки (React Router)

*Тема:*
- Хранение выбора в localStorage
- `useTheme()` хук; переключатель в ⚙️

*Офлайн-индикатор:*
- Компонент с тремя состояниями из S14 (offline/syncing/+queue count)
- Используется на всех экранах в header

**Результат:** логин работает, роли разведены, тема переключается, оффлайн-индикатор виден.

---

### I-06 — Конструктор стеллажа (Admin)

**Цель:** полноценный ShelfGrid в edit-режиме — создание, сплиты, мержи, назначение товаров.

**Читать:** S00, S01, S02, S03, S11

**Сделать** (в `src/features/shelf/`):

*`ShelfGrid` компонент (mode="edit" | "view"):*
- L1: сетка N×M с 2D-скроллом, ячейки ≥ 64px
- Рекурсивный drill-down: тап на сплитованную → новый экран с потомками (CSS Grid, пропорции 50/50)
- Листовая ячейка в edit-режиме → bottom sheet с действиями (S11)

*Действия над ячейкой (edit):*
- Назначить/сменить/убрать товар (выбор из каталога, поиск по имени)
- Разделить → / ↓ (вертикально/горизонтально); пересчёт computed_mm
- Объединить с BSP-соседом; предупреждение если есть товар
- Настройки ячейки: размеры (мм), capacity_override, rotation_allowed toggle

*Управление стеллажом:*
- Создание стеллажа (N строк × M столбцов) — первый запуск admin
- Добавить строку снизу / столбец справа (только append)
- Переименовать стеллаж

*Флаги ячейки:*
- Отображение needs_review (⚠ иконка), rotation отключён, ручная вместимость
- Тап на ⚠ (edit-режим) → модальное окно с объяснением + "Всё в порядке ✓"

*Realtime-обновления:* подписка на cells → при изменении обновляется сетка без перезагрузки

**Результат:** admin может полностью настроить стеллаж.

---

### I-07 — Ввод остатков (Employee/Admin)

**Цель:** полный flow обхода — начать сессию, внести остатки, перейти к заявке.

**Читать:** S00, S04, S05, S11, S12

**Сделать** (в `src/features/stock/`):

*Экран обхода:*
- `ShelfGrid` в mode="view" с прогресс-строкой "N из M ✓ → К заявке"
- Логика старта сессии: проверка наличия активной `sweeping`-сессии → показ менеджера конфликта (S14)
- Ячейки с внесёнными остатками → "✓ Внесено сегодня" зелёным

*Форма ввода остатка:*
- Для `unit`/`round`: числовое поле, inputmode="numeric", ≥16px, кнопка Сохранить 56px
- Для `bulk`: слайдер 0–100%, подпись "≈ N пачек" в реальном времени
- Показ вместимости (не предыдущий остаток)
- Валидация остаток > вместимость → блокировка кнопки

*Сохранение:*
- `writeOnline` (оптимистично + rollback) или enqueue (offline)
- Toast "✓ Внесено: N из M шт" с убывающим прогресс-баром (S00)
- После toast → автозакрытие формы → возврат к сетке

*Realtime:* при изменении товара во время открытой формы → закрыть форму + toast (S12)

*Предупреждение < 50%:* диалог при переходе к заявке если внесено < 50% активных ячеек

**Результат:** employee может пройти стеллаж и перейти к заявке.

---

### I-08 — Заявка и чеклист

**Цель:** полный flow от черновика заявки до отметки всех позиций.

**Читать:** S00, S05, S06, S13

**Сделать** (в `src/features/order/`, `src/features/checklist/`):

*Черновик заявки (ordering):*
- Генерация при переходе sweeping→ordering: запуск `buildOrderLines` из domain
- Список строк с сортировкой (материал → длина → название)
- Блок пограничных позиций внизу
- Тап на строку → bottom sheet: `[−][N][+]` + Сохранить + Удалить из заявки
- Тап на пограничную → bottom sheet: `[Включить в заявку]` → стандартный диалог
- Кнопка Финализировать (48px) → bottom sheet с итогом (N позиций, M пачек) → необратимый переход
- Кнопка ← К обходу: возврат в sweeping без потери данных

*Чеклист (fulfilling):*
- Sticky header "Взято N из M" + заполняющийся прогресс-бар
- Иконка принтера → `window.print()` (браузерная печать)
- Строки: pending вверху, done/unavailable в конце
- Кнопка `[Взял]` справа на каждой строке: один тап → done, actual_packs = quantity_packs + анимация
- Тап на строку → bottom sheet: `[Взял всё] / [Взял меньше...] / [Нет на складе]`
- Взял меньше → вложенный bottom sheet с `[−][N][+]`
- Тап на done/unavailable строку → повторный bottom sheet (undo)
- Toast завершения: auto-dismiss "✓ Все позиции отмечены" (~3 сек)

*PDF-экспорт:* `@media print` стили для бумажного бланка (S06)

**Результат:** employee может пройти полный цикл от заявки до отметки.

---

### I-09 — Экран «Сессии» и история

**Цель:** единый экран сессий для обеих ролей — активные + история + admin-функции.

**Читать:** S00, S05, S07, S08, S14

**Сделать** (в `src/features/sessions/`):

*Основной список:*
- Активные сессии (sweeping/ordering/fulfilling) — карточки с иконкой фазы
- Кнопка "[+ Начать новый обход]" — логика блокировки при активном sweeping/ordering
- Кнопка "Отменить" на карточке: подтверждение → abandoned
- Чужой активный обход: карточка only-read для employee; + "[Завершить ×]" для admin

*История (inline ниже):*
- Список completed/abandoned сессий: дата, статус-иконка, кол-во позиций, длительность
- Тап → экран деталей сессии (plan vs fact таблица из S08)

*Admin-only:*
- "[Агрегаты по товарам →]" → экран со статистикой по каждому товару (S08)
- "[Экспорт Excel ↓]" → генерация xlsx на клиенте через exceljs

*Конфликт при старте:* если пытаются начать обход при чужой sweeping-сессии → показать диалог с состоянием чужой сессии

**Результат:** обе роли видят полную картину сессий; admin управляет.

---

### I-10 — Каталог и материалы

**Цель:** admin может управлять каталогом товаров и справочником материалов.

**Читать:** S00, S01, S07

**Сделать** (в `src/features/catalog/`):

*Список товаров:*
- Список с фильтрацией по материалу (горизонтальные chips)
- Поиск по имени
- Тап → форма редактирования; кнопка "+ Добавить"

*Форма товара:*
- Поля: название, тип (radio: unit/bulk/round), материал, pack_size
- Условные поля: width_mm + height_mm (только unit), diameter_mm (только round), length_mm (unit + round)
- Валидация через Zod; react-hook-form
- При удалении: подтверждение → cascade: снять с ячеек + needs_review + toast

*Управление материалами:*
- Встроено в экран каталога (bottom sheet или отдельная секция)
- Добавить: название + color picker
- Редактировать/удалить (с подтверждением, если есть товары)
- Предустановленные (Дерево, Пластик, Металл) — редактировать цвет можно, удалить нельзя

**Результат:** admin полностью управляет ассортиментом.

---

### I-11 — Настройки, аккаунты, журнал

**Цель:** admin управляет пользователями и видит журнал действий.

**Читать:** S00, S07

**Сделать** (в `src/features/admin/`):

*Аккаунты:*
- Список пользователей: имя, email, роль, статус (active/blocked)
- Тап → детали; кнопки: Заблокировать / Разблокировать / Удалить (с подтверждением)
- Форма создания: имя, email, роль → вызов `create-user` Edge Function → Supabase отправляет invite

*Журнал действий:*
- Список audit_log записей (новые сверху)
- Human-readable формат: "{actor} {действие} {объект} {детали}" — маппинг event_type → читаемый текст
- Фильтры: по пользователю, по категории, по дате (date range picker)

**Результат:** admin видит все действия и управляет командой.

---

### I-12 — Финализация и деплой

**Цель:** приложение в production, CI/CD работает, PWA устанавливается.

**Читать:** S09, S10

**Сделать:**

*PWA:*
- `vite-plugin-pwa`: SW-стратегии из S09 (CacheFirst для статики, NetworkFirst для index.html, NetworkOnly для Supabase)
- skipWaiting + clientsClaim
- `navigator.storage.persist()` при первом запуске
- Иконки всех размеров, web manifest

*CI/CD (`.github/workflows/ci.yml`):*
- На каждый push: `pnpm typecheck` + `pnpm test`
- Красные тесты блокируют merge

*Vercel:*
- Подключить GitHub repo → auto-deploy main
- Env variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- SPA redirect (все пути → index.html)

*prefers-reduced-motion:*
- Глобальный CSS: при `prefers-reduced-motion: reduce` анимации Motion отключены

*QA (ручная проверка):*
- Полный сценарий: создать стеллаж → настроить ячейки → добавить товары → начать обход → заявка → чеклист → история
- Оффлайн-режим: потерять связь во время обхода → восстановить → проверить синхронизацию
- PWA: установить на телефон (Android Chrome + iOS Safari)

**Результат:** приложение задеплоено и доступно по URL Vercel.

---

## Зависимости между сессиями

```
I-01 (setup)
  └── I-02 (schema) ──────────────────┐
  └── I-03 (domain) ─────────────────┐│
       └── I-04 (data layer)          ││
            └── I-05 (auth+shell)     ││
                 ├── I-06 (shelf)  ←──┘│
                 ├── I-07 (stock)  ←───┤
                 ├── I-08 (order/checklist)
                 ├── I-09 (sessions)
                 ├── I-10 (catalog) ←──┘
                 └── I-11 (admin)
                      └── I-12 (deploy)
```

I-03 (domain) и I-02 (schema) можно делать параллельно после I-01. I-06 через I-11 можно делать в любом порядке после I-05, но каждая читает результаты I-02 и I-04.

---

## Что в каждой сессии читать

| Сессия | Обязательно читать |
|--------|--------------------|
| I-01 | CLAUDE.md, S00, S10 |
| I-02 | CLAUDE.md, S01–S07, S09, S10 |
| I-03 | CLAUDE.md, S01, S02, S03, S05 |
| I-04 | CLAUDE.md, S09, S10 |
| I-05 | CLAUDE.md, S00, S07, S14 |
| I-06 | CLAUDE.md, S00, S01, S02, S03, S11 |
| I-07 | CLAUDE.md, S00, S04, S05, S11, S12 |
| I-08 | CLAUDE.md, S00, S05, S06, S13 |
| I-09 | CLAUDE.md, S00, S05, S07, S08, S14 |
| I-10 | CLAUDE.md, S00, S01, S07 |
| I-11 | CLAUDE.md, S00, S07 |
| I-12 | CLAUDE.md, S09, S10 |
