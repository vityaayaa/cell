# I-03 — Auth + App Shell

## Контекст

I-02 завершена: Supabase-схема применена (11 таблиц, RLS, триггеры), Edge Functions задеплоены, весь data layer создан (`src/data/`). Приложение собирается чисто (`pnpm build`). Этот промпт — Auth, роутинг, App Shell и онбординг первого запуска. Без React-компонентов для стеллажа, каталога и остатков.

---

## Прочитай перед началом

**Спеки:**
- `docs/specs/S07-roles.md` — роли admin/employee, invite-процесс, управление аккаунтами
- `docs/specs/S14-navigation.md` — навигационная архитектура, экраны, BottomNav, ролевые оболочки
- `docs/specs/S00-design-system.md` — токены цветов, шрифты, размеры (touch targets ≥ 64px)

**Код из предыдущих сессий:**
- `src/data/supabase.ts` — `supabase` клиент
- `src/data/store.ts` — `useAppStore`, экшены: `setUser`, `clearUser`, `setOnline`, `setActiveSession`
- `src/data/db.ts` — Dexie db, типы: `UserProfile`, `Session`
- `src/data/sync.ts` — `initialLoad()`, `checkOnline()`
- `src/data/database.types.ts` — `Tables<'user_profiles'>`, `Enums<'user_role'>`
- `package.json` — установленные версии: react-router 7.16.0, zustand 5.0.14

**Скиллы для этой сессии:**
- Перед написанием UI-компонентов: вызови `/ui-ux-pro-max`
  (shadcn/ui, Tailwind v4, mobile-first, touch targets ≥ 64px из S00)
- Если баг не решается за 2 попытки: вызови `/superpowers:systematic-debugging`
- В конце сессии: вызови `/superpowers:finishing-a-development-branch`, затем `/superpowers:verification-before-completion`

---

## Цель сессии

Приложение запускается, показывает экран входа или онбординг первого запуска, после входа показывает ролевую оболочку с BottomNav.

---

## Задачи

### 1. React Router и корневая структура

Создать `src/app/router.tsx` — все маршруты приложения.

Структура маршрутов:
```
/                  → RedirectByAuth (если не залогинен → /login, если залогинен → /app)
/login             → LoginPage
/onboarding        → OnboardingPage (создание первого admin)
/app               → AppShell (требует auth)
  /app/shelf       → EmployeeShellLayout (default route внутри /app)
  /app/sessions    → SessionsPage
  /app/admin       → AdminShellLayout (только admin, redirect если employee)
    /app/admin/catalog   → CatalogPage (заглушка)
    /app/admin/shelf-config → ShelfConfigPage (заглушка)
    /app/admin/users  → UsersPage (заглушка)
    /app/admin/audit  → AuditPage (заглушка)
```

Создать `src/app/providers.tsx` — QueryClient (если нужен) + Supabase session listener.

### 2. Auth hook

Создать `src/app/useAuth.ts`:

```typescript
// Слушает изменения сессии Supabase
// При login: загружает user_profile из Dexie (или Supabase если нет), вызывает store.setUser(id, role)
// При logout: вызывает store.clearUser()
// Возвращает: { session, userProfile, isLoading }
export function useAuth(): { session: Session | null; userProfile: UserProfile | null; isLoading: boolean }
```

Как проверить роль: через таблицу `user_profiles` — NOT через `user_metadata`. После логина делать:
```typescript
const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', userId).single()
// role = profile.role ('admin' | 'employee')
```

### 3. LoginPage

Создать `src/features/auth/LoginPage.tsx`.

- Email + Password поля (react-hook-form + zod)
- Кнопка "Войти"
- Ссылка "Забыл пароль?" → вызывает `supabase.auth.resetPasswordForEmail(email)`
- При ошибке: toast (sonner) с русским сообщением
- После успешного входа: router.push('/app')
- При загрузке страницы: если уже залогинен → redirect на /app

### 4. OnboardingPage

Создать `src/features/auth/OnboardingPage.tsx`.

Показывается только при первом запуске (нет ни одного пользователя в системе).
Определение: при открытии приложения запросить Edge Function `create-first-admin` с пустым телом — если вернётся `{ error: 'Admin already exists...' }`, то онбординг не нужен.

Форма: Имя, Email, Пароль (мин. 8 символов).

После создания: автоматический вход, redirect на /app.

Edge Function URL:
```
POST ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-first-admin
Body: { name, email, password }
```

**Логика определения первого запуска:**
Проверить в `useAuth` или в корневом компоненте: попробовать загрузить `user_profiles` без auth — если 0 записей (или ошибка RLS) → считать первым запуском → redirect на /onboarding.

Более надёжный способ: сделать анонимный запрос к Edge Function `create-first-admin` с методом GET (или отдельный healthcheck endpoint) — но это усложнит. Проще: использовать Supabase count на `user_profiles` без auth — если count = 0, показать онбординг.

### 5. AppShell + BottomNav

Создать `src/app/AppShell.tsx` — обёртка для авторизованной зоны:
- Проверяет auth: если нет сессии → redirect /login
- Рендерит BottomNav + `<Outlet />`
- Запускает `initialLoad()` при монтировании (однократно)
- Подписывается на `navigator.onLine` events → вызывает `store.setOnline()`

Создать `src/app/BottomNav.tsx`:

BottomNav из S14 — разный набор вкладок по роли:

**Employee:**
| Иконка | Метка | Маршрут |
|--------|-------|---------|
| Grid | Стеллаж | /app/shelf |
| List | Сессии | /app/sessions |

**Admin:**
| Иконка | Метка | Маршрут |
|--------|-------|---------|
| Grid | Стеллаж | /app/shelf |
| List | Сессии | /app/sessions |
| Settings | Управление | /app/admin |

Touch target ≥ 64px (S00).

### 6. Заглушки экранов

Создать минимальные placeholder-компоненты для всех маршрутов (чтобы роутинг работал):

- `src/features/shelf/ShelfPage.tsx` — "Стеллаж (I-04)"
- `src/features/sessions/SessionsPage.tsx` — "Сессии (I-06)"
- `src/features/admin/CatalogPage.tsx` — "Каталог (I-07)"
- `src/features/admin/ShelfConfigPage.tsx` — "Настройка стеллажа (I-04)"
- `src/features/admin/UsersPage.tsx` — "Пользователи (I-07)"
- `src/features/admin/AuditPage.tsx` — "Аудит (I-07)"

### 7. Управление пользователями (базовое, только UI)

Создать `src/features/admin/users/UserManagementPage.tsx`:
- Список пользователей из `user_profiles` через `useLiveQuery`
- Кнопка "Создать пользователя" → modal с формой (Имя, Email, Роль)
- Отправка в Edge Function `create-user`:
  ```
  POST ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user
  Authorization: Bearer <access_token>
  Body: { name, email, role }
  ```
- Access token: `const { data: { session } } = await supabase.auth.getSession()`
- Блокировка/разблокировка пользователя: `supabase.from('user_profiles').update({ is_active }).eq('id', userId)`

---

## Не делать в этой сессии

- Компоненты стеллажа (ShelfGrid, CellCard) — I-04
- Экран ввода остатков (StockEntrySheet) — I-05
- Экран заявки/чеклиста — I-05, I-06
- Экран истории сессий (полная реализация) — I-06
- Каталог товаров (CatalogPage полностью) — I-07
- Realtime подписки на изменения стеллажа — I-04
- PDF-экспорт — I-06
- Excel-экспорт — I-07

---

## Результат

По завершении сессии:
- [ ] `pnpm build` — 0 ошибок TypeScript
- [ ] В браузере: `/login` показывает форму входа
- [ ] В браузере: при первом запуске (нет пользователей) — `/onboarding`
- [ ] После входа как admin: видны 3 вкладки в BottomNav (Стеллаж, Сессии, Управление)
- [ ] После входа как employee: видны 2 вкладки (Стеллаж, Сессии)
- [ ] Redirect: `/admin/*` как employee → redirect на /app/shelf
- [ ] `pnpm test` — 28 тестов зелёные (тесты из I-01 не сломаны)

---

## Инвентарь I-02 — что создано

### Supabase

**Project:** `jlpliikumvevqvhajbbw`
**URL:** `https://jlpliikumvevqvhajbbw.supabase.co`
**Anon key:** в `.env.local` → `VITE_SUPABASE_ANON_KEY`

**Таблицы (все с RLS):**
`materials`, `products`, `shelves`, `cells`, `user_profiles`, `sessions`, `stock_entries`, `orders`, `order_lines`, `checklist_entries`, `audit_log`

**Edge Functions (ACTIVE, verify_jwt: false — проверяют JWT внутри сами):**
- `create-first-admin` — POST, body: `{ name, email, password }`. Работает только если нет ни одного профиля.
- `create-user` — POST, header: `Authorization: Bearer <token>`, body: `{ name, email, role }`. Только для admin.

URL паттерн: `${VITE_SUPABASE_URL}/functions/v1/<function-name>`

### src/data/supabase.ts
```typescript
export const supabase  // SupabaseClient<Database>
```

### src/data/database.types.ts
```typescript
export type Database      // полные типы схемы
export type Tables<T>     // Tables<'materials'> → Row тип
export type TablesInsert<T>
export type TablesUpdate<T>
export type Enums<T>      // Enums<'user_role'> → 'admin' | 'employee'
```

### src/data/db.ts
```typescript
export const db  // Dexie instance
// Таблицы: db.materials, db.products, db.shelves, db.cells,
//           db.user_profiles, db.sessions, db.stock_entries,
//           db.orders, db.order_lines, db.checklist_entries, db.sync_queue
export type { Material, Product, Shelf, Cell, UserProfile,
              Session, StockEntry, Order, OrderLine,
              ChecklistEntry, SyncQueueItem }
```

### src/data/store.ts
```typescript
export const useAppStore  // Zustand store

// Состояние:
// isOnline: boolean
// isSyncing: boolean
// syncQueueLength: number
// userId: string | null
// userRole: 'admin' | 'employee' | null
// activeSessionId: string | null

// Экшены:
// setOnline(v: boolean)
// setSyncing(v: boolean)
// setSyncQueueLength(n: number)
// setUser(id: string, role: 'admin' | 'employee')
// clearUser()
// setActiveSession(id: string | null)
```

### src/data/sync.ts
```typescript
export async function initialLoad(): Promise<void>
// Грузит materials, products, shelves, cells в Dexie

export function subscribeToTable(table: string, onChanged: (payload: any) => void): RealtimeChannel

export async function flushQueue(): Promise<void>
// Отправляет sync_queue на Supabase

export async function checkOnline(): Promise<boolean>
// Ping к Supabase — реальная проверка связи
```

### Решения, отличающиеся от спек

1. **Роль пользователя — в таблице `user_profiles`**, не в `user_metadata` Supabase Auth. Проверять через `supabase.from('user_profiles').select('role').eq('id', userId).single()`.

2. **`create-user` использует `inviteUserByEmail`** — пользователь получает письмо, устанавливает пароль сам (соответствует S07).

3. **`create-first-admin` использует `createUser` с `email_confirm: true`** — пароль задаётся сразу при создании (для первого запуска удобнее).

4. **`sync_queue.operation`** — `'upsert' | 'delete'` (промпт I-02) вместо `'insert' | 'update' | 'delete'` (S09). При использовании sync_queue всегда upsert.

5. **`stock_entries` не имеет `updated_at`** — append-only лог, только `created_at`.

### Что НЕ сделано в I-02

- React-компоненты — всё начиная с I-03
- Realtime-подписки (заготовка `subscribeToTable` есть, но нигде не вызывается)
- Seed-данные для предустановленных материалов (Дерево, Пластик, Металл) — можно сделать в I-03 или отдельной миграцией

---

## В конце этой сессии: написать промпт I-04

Прочитай `docs/sessions/PROMPT-GUIDE.md`.

Создать `docs/sessions/prompts/I-04-shelf-builder.md`.

**Что обязательно включить в I-04:**
1. Маршруты и компоненты из I-03: точные пути файлов и экспорты
2. Как вызывается `initialLoad()` — при каком событии/компоненте
3. Как читать данные из Dexie через `useLiveQuery` — пример
4. Какие заглушки нужно заменить реальными компонентами (ShelfPage, ShelfConfigPage)
5. Состояние store к концу I-03: `userId`, `userRole` — откуда берутся
