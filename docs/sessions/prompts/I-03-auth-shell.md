# I-03 — Auth + App Shell

## Контекст

I-01 и I-02 завершены: проект инициализирован, domain-логика написана (28 тестов зелёные), Supabase-схема применена (11 таблиц, RLS, триггеры), data layer создан. Эта сессия — авторизация, роутинг и навигационные оболочки по ролям. React-компоненты стеллажа и бизнес-логики — в I-04+.

**ПРЕДУПРЕЖДЕНИЕ:** В репозитории может лежать старый файл I-03 с неверной навигацией (написан без чтения S14). Этот файл — единственный источник истины. Старый вариант игнорировать.

---

## Прочитай перед началом

**Спеки:**
- `docs/specs/S14-ui-navigation.md` — ОБЯЗАТЕЛЬНО. Вся навигационная архитектура: Employee без таббара, Admin 3 вкладки, экраны, восстановление навигации по статусу сессии
- `docs/specs/S07-roles.md` — роли admin/employee, invite-процесс Supabase Auth, первый запуск
- `docs/specs/S00-design-system.md` — токены цветов, touch targets ≥ 64px, анимации

**Код из предыдущих сессий:**
- `src/data/supabase.ts` — `supabase` клиент
- `src/data/store.ts` — `useAppStore`: поля `isOnline`, `userId`, `userRole`, `activeSessionId`; экшены `setUser`, `clearUser`, `setOnline`, `setActiveSession`
- `src/data/db.ts` — Dexie db, типы: `UserProfile`, `Session`, все остальные
- `src/data/sync.ts` — `initialLoad()`, `checkOnline()`
- `src/data/database.types.ts` — `Tables<T>`, `Enums<T>`
- `package.json` — версии: react-router 7.16.0, zustand 5.0.14, react-hook-form 7.x, zod 4.x

**Скиллы для этой сессии:**
- Перед написанием компонентов: вызови `/ui-ux-pro-max` (shadcn/ui, Tailwind v4, mobile-first, touch ≥ 64px из S00)
- Если баг не решается за 2 попытки: вызови `/superpowers:systematic-debugging`
- В конце: `/superpowers:finishing-a-development-branch`, затем `/superpowers:verification-before-completion`

---

## Цель сессии

После входа employee видит экран Сессий без таббара. После входа admin видит экран Сессий с 3 вкладками снизу. Тема переключается и сохраняется.

---

## Навигационная архитектура (источник: S14 — читать полностью)

### Employee — без таббара, линейный стек

```
/app/sessions              ← главный экран, всегда первый
    ↓ "Начать обход" / "Продолжить →"
/app/shelf                 ← Стеллаж (view + прогресс обхода)
    ↓ "→ К заявке"
/app/order                 ← Черновик заявки
    ↓ "Финализировать"
/app/checklist/:sessionId  ← Чеклист
/app/session/:id           ← Детали завершённой сессии
```

Кнопка ← в header возвращает на шаг назад.
⚙️ в header (top-right) → **bottom sheet**: переключатель темы + "Выйти из аккаунта".

### Admin — 3 вкладки + ⚙️

```
Tab 1: /app/sessions       ← 📋 Сессии (основные полномочия + admin-действия)
   ↓ сессионный стек тот же: /app/shelf → /app/order → /app/checklist/:id
Tab 2: /app/catalog        ← 📦 Каталог (edit: добавить/изменить/удалить товар)
Tab 3: /app/shelf-config   ← 🏪 Стеллаж (всегда edit mode, конфигурация)
⚙️ → /app/settings        ← отдельный экран Настройки
     /app/settings/users   ← Аккаунты
     /app/settings/audit   ← Журнал действий
```

Таб активен если `location.pathname` начинается с:
- Сессии (Tab 1): `/app/sessions`, `/app/shelf`, `/app/order`, `/app/checklist`
- Каталог (Tab 2): `/app/catalog`
- Стеллаж (Tab 3): `/app/shelf-config`

Каждый таб поддерживает свой стек навигации (браузерная история).

---

## Задачи

### 1. Маршруты: `src/app/router.tsx`

```typescript
// Публичные
/                          → <RedirectByAuth />
/login                     → <LoginPage />
/onboarding                → <OnboardingPage />

// Авторизованная зона
/app                       → <AppShell /> (auth guard)
  /app/sessions            → <SessionsPage />        (заглушка "I-06")
  /app/shelf               → <ShelfPage />           (заглушка "I-04/I-05")
  /app/order               → <OrderDraftPage />      (заглушка "I-05")
  /app/checklist/:sessionId → <ChecklistPage />      (заглушка "I-06")
  /app/session/:id         → <SessionDetailPage />   (заглушка "I-06")
  /app/catalog             → <CatalogPage />         (заглушка "I-07", admin only)
  /app/shelf-config        → <ShelfConfigPage />     (заглушка "I-04", admin only)
  /app/settings            → <SettingsPage />        (admin only)
  /app/settings/users      → <UsersPage />           (admin only)
  /app/settings/audit      → <AuditPage />           (заглушка "I-07", admin only)
```

**`RedirectByAuth`:** нет сессии → `/login`; есть сессия + нет пользователей в системе → `/onboarding`; есть сессия → `/app/sessions`.

**Защита:** `/app/catalog`, `/app/shelf-config`, `/app/settings/*` — только admin. Employee → redirect `/app/sessions`.

### 2. `src/app/useAuth.ts`

```typescript
export function useAuth(): {
  session: Session | null
  userProfile: UserProfile | null
  isLoading: boolean
}
```

- Подписывается на `supabase.auth.onAuthStateChange()`
- При логине: `supabase.from('user_profiles').select('*').eq('id', userId).single()`
- Сохраняет профиль в Dexie: `db.user_profiles.put(profile)` (для офлайн-доступа)
- Вызывает `store.setUser(id, role)` при логине; `store.clearUser()` при выходе
- `isLoading = true` до первого ответа onAuthStateChange

### 3. `src/features/auth/LoginPage.tsx`

```
CELL

Email
[                    ]

Пароль
[                    ]

[Войти]

Забыл пароль?
```

- react-hook-form + zod: email обязателен, пароль мин. 6 символов
- Кнопка "Войти": 56px, `--primary`
- "Забыл пароль?": `supabase.auth.resetPasswordForEmail(email)` + toast "Письмо отправлено"
- При ошибке: toast с русским текстом ("Неверный email или пароль")
- После успешного входа: `navigate('/app/sessions')`
- Если уже залогинен при открытии /login → redirect `/app/sessions`

### 4. `src/features/auth/OnboardingPage.tsx`

Показывается при первом запуске системы (нет ни одного пользователя).

**Определение первого запуска** в `RedirectByAuth`:
```typescript
// Метод: попробовать анонимный GET на create-first-admin
// POST с пустым {} → если 409/{ alreadyExists: true } → система уже есть → /login
// Если 200 → первый запуск → /onboarding
const res = await fetch(`${VITE_SUPABASE_URL}/functions/v1/create-first-admin`, {
  method: 'POST', body: JSON.stringify({}),
  headers: { 'Content-Type': 'application/json' },
})
// 400/409 = уже есть admin → /login
// другое = форма доступна → /onboarding
```

Форма: Имя, Email, Пароль (мин. 8 символов).

После создания: `supabase.auth.signInWithPassword({ email, password })` → `navigate('/app/sessions')`.

### 5. `src/app/AppShell.tsx`

```typescript
// Проверяет auth: isLoading → skeleton; нет сессии → /login
// Запускает initialLoad() один раз при монтировании (useEffect с пустым массивом зависимостей)
// Слушает navigator.onLine events → store.setOnline()
// По userRole рендерит AdminLayout или EmployeeLayout
```

### 6. `src/app/EmployeeLayout.tsx`

```
┌──────────────────────────────────┐
│ CELL           [offline?]    ⚙️  │  ← 56px header
├──────────────────────────────────┤
│                                  │
│           <Outlet />             │
│                                  │
└──────────────────────────────────┘
```

- Нет таббара
- ⚙️: Lucide `Settings` иконка, tap area 44×44px, открывает `SettingsBottomSheet`
- Офлайн-индикатор между названием и ⚙️

### 7. `src/app/AdminLayout.tsx`

```
┌──────────────────────────────────┐
│ CELL           [offline?]    ⚙️  │  ← 56px header
├──────────────────────────────────┤
│                                  │
│           <Outlet />             │
│                                  │
├──────────────────────────────────┤
│   📋 Сессии  📦 Каталог  🏪      │  ← 64px tab bar
└──────────────────────────────────┘
```

- 3 таба, высота 64px, иконки 24px (Lucide: `ListChecks` | `Package` | `Warehouse`)
- Активный таб: `--primary` (оранжевый); неактивный: `--muted-foreground`
- ⚙️ в header → `navigate('/app/settings')` (не bottom sheet)

### 8. `src/app/BottomNav.tsx`

Используется только AdminLayout. Определяет активный таб через `useLocation()`:

```typescript
const tabs = [
  { label: 'Сессии', icon: ListChecks, paths: ['/app/sessions', '/app/shelf', '/app/order', '/app/checklist'], to: '/app/sessions' },
  { label: 'Каталог', icon: Package, paths: ['/app/catalog'], to: '/app/catalog' },
  { label: 'Стеллаж', icon: Warehouse, paths: ['/app/shelf-config'], to: '/app/shelf-config' },
]
```

### 9. `src/app/OfflineIndicator.tsx`

Встроен в header AdminLayout и EmployeeLayout. Состояние из `useAppStore`:

| `isOnline` | `isSyncing` | `syncQueueLength` | Показывает |
|:---:|:---:|:---:|---|
| true | false | 0 | — (ничего) |
| true | true | any | ↻ "Синхронизация..." |
| false | false | 0 | ● "Офлайн" (серый) |
| false | false | >0 | ● "Офлайн · N записей" (серый) |

После восстановления связи: зелёная ● "Снова онлайн", 3 секунды, потом исчезает.

Реализация через `useEffect` с `navigator.onLine` listener + `window.addEventListener('online', ...)`.

### 10. `src/app/SettingsBottomSheet.tsx`

Bottom sheet для Employee (⚙️):

```
────────────────────────────────────
Тема
● Светлая  ○ Тёмная  ○ OLED

[Выйти из аккаунта]
────────────────────────────────────
```

- shadcn `Sheet` компонент, `side="bottom"`
- 3 радиокнопки темы, выбранная подсвечена `--primary`
- "Выйти": `supabase.auth.signOut()` → `navigate('/login')`

### 11. `src/features/admin/SettingsPage.tsx`

Полноэкранный экран для Admin (/app/settings):

```
← Настройки

  Аккаунты                       →   (navigate /app/settings/users)
  Журнал действий                →   (navigate /app/settings/audit)

  ─────────────────────────────
  Тема
  ● Светлая  ○ Тёмная  ○ OLED
  ─────────────────────────────

  Иван · admin
  [Выйти из аккаунта]
```

- Header: ← (back) + "Настройки"
- Имя и роль из `useAppStore().userId` → из Dexie `db.user_profiles.get(userId)`

### 12. Тема: `src/app/ThemeProvider.tsx`

```typescript
// При монтировании: читает localStorage.getItem('cell-theme') ?? 'light'
// Устанавливает document.documentElement.setAttribute('data-theme', theme)

export function useTheme(): {
  theme: 'light' | 'dark' | 'oled'
  setTheme: (t: 'light' | 'dark' | 'oled') => void
}
```

Оборачивает всё приложение в `main.tsx`.

### 13. `src/features/admin/UsersPage.tsx`

```
← Аккаунты                  [+ Добавить]

  ┌──────────────────────────────────┐
  │ Иван Иванов                      │
  │ admin · активен                  │
  │                  [Заблокировать] │
  └──────────────────────────────────┘
  ┌──────────────────────────────────┐
  │ Пётр Петров                      │
  │ employee · заблокирован          │
  │               [Разблокировать]   │
  └──────────────────────────────────┘
```

- Данные: `useLiveQuery(() => db.user_profiles.orderBy('created_at').toArray())`
- Блокировка: optimistic update в Dexie → `supabase.from('user_profiles').update({ is_active: false }).eq('id', id)` → при ошибке откат + toast
- "+ Добавить" → Dialog с формой (Имя, Email, Роль) → POST:
  ```typescript
  fetch(`${VITE_SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, email, role }),
  })
  ```

### 14. Заглушки экранов

Создать минимальные компоненты (только текст, чтобы роутинг работал):

| Файл | Текст заглушки |
|------|----------------|
| `src/features/sessions/SessionsPage.tsx` | "Сессии (I-06)" |
| `src/features/shelf/ShelfPage.tsx` | "Стеллаж — вид обхода (I-04/I-05)" |
| `src/features/order/OrderDraftPage.tsx` | "Черновик заявки (I-05)" |
| `src/features/checklist/ChecklistPage.tsx` | "Чеклист (I-06)" |
| `src/features/sessions/SessionDetailPage.tsx` | "Детали сессии (I-06)" |
| `src/features/catalog/CatalogPage.tsx` | "Каталог (I-07)" |
| `src/features/shelf/ShelfConfigPage.tsx` | "Настройка стеллажа (I-04)" |
| `src/features/admin/AuditPage.tsx` | "Журнал действий (I-07)" |

### 15. Исправление схемы I-02 (проверить в начале сессии)

Проверить через `mcp__claude_ai_Supabase__list_tables` или через `execute_sql`:

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_entries';
SELECT column_name FROM information_schema.columns WHERE table_name = 'order_lines';
```

**Если нужно исправить:**

Создать миграцию `supabase/migrations/005_schema_fixes.sql`:

```sql
-- Поле value в stock_entries (S04 называет его value, не quantity)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name='stock_entries' AND column_name='quantity'
  ) THEN
    ALTER TABLE stock_entries RENAME COLUMN quantity TO value;
  END IF;
END $$;

-- product_name в order_lines (S08: снимок имени товара)
ALTER TABLE order_lines
  ADD COLUMN IF NOT EXISTS product_name TEXT NOT NULL DEFAULT '';

-- Seed предустановленных материалов (S01: Дерево, Пластик, Металл)
INSERT INTO materials (id, name, color, is_custom, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Дерево', '#D4A574', false, now(), now()),
  (gen_random_uuid(), 'Пластик', '#64B5F6', false, now(), now()),
  (gen_random_uuid(), 'Металл', '#9E9E9E', false, now(), now())
ON CONFLICT DO NOTHING;
```

Применить через `mcp__claude_ai_Supabase__apply_migration`.

---

## Не делать в этой сессии

- ShelfGrid, CellCard компоненты (визуал стеллажа) — I-04
- StockEntryForm, логика обхода, прогресс-бар — I-05
- OrderDraftPage реализация — I-05
- ChecklistPage реализация — I-06
- SessionsPage реализация — I-06
- CatalogPage реализация — I-07
- AuditPage реализация — I-07
- Realtime-подписки (кроме auth session) — I-04/I-05

---

## Результат

- [ ] `pnpm build` — 0 ошибок TypeScript
- [ ] `pnpm test` — 28 тестов зелёные
- [ ] `/login` показывает форму входа
- [ ] Первый запуск (нет пользователей): `/onboarding`
- [ ] Вход как employee → экран Сессий, **нет таббара**, есть ⚙️ в header
- [ ] Вход как admin → экран Сессий, **3 вкладки снизу**: Сессии | Каталог | Стеллаж, ⚙️ в header
- [ ] Admin ⚙️ → полноэкранный `/app/settings`
- [ ] Employee ⚙️ → bottom sheet (тема + выйти)
- [ ] Тема меняется и сохраняется через localStorage
- [ ] `/app/catalog` как employee → redirect `/app/sessions`
- [ ] Офлайн-индикатор меняется при потере/восстановлении связи
- [ ] Схема исправлена: `stock_entries.value`, `order_lines.product_name`, seed materials

---

## Инвентарь для I-04

Создать `docs/sessions/prompts/I-04-shelf-builder.md` (шаблон в PROMPT-GUIDE.md).

**Что обязательно включить:**

1. **Структура файлов `src/app/`**: EmployeeLayout, AdminLayout, AppShell, router — с точными экспортами
2. **Как читать из Dexie**: пример `useLiveQuery(() => db.cells.where('shelf_id').equals(id).toArray())`
3. **Как писать оптимистично**: паттерн из S09/S10 — сначала Dexie, потом Supabase, откат при ошибке
4. **Точные маршруты**: `/app/shelf` (view mode, обход), `/app/shelf-config` (edit mode, admin)
5. **Как определить role**: `useAppStore().userRole`
6. **Что ещё НЕ сделано**: ShelfGrid, CellCard, ShelfPage реализация — задача I-04
7. **Что исправлено в схеме**: результат проверки и применения 005_schema_fixes.sql
