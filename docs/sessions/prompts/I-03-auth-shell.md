# I-03 — Auth + App Shell

## Контекст

I-01 и I-02 завершены: проект инициализирован, domain-логика написана (28 тестов зелёные), Supabase-схема применена, data layer создан. Эта сессия — авторизация, роутинг и навигационная оболочка с морфингом таббара.

---

## Прочитай перед началом

**Спеки:**
- `docs/specs/S14-ui-navigation.md` — ОБЯЗАТЕЛЬНО. Морфинг таббара: домашний/сессионный режим, поведение ←, ⚙️
- `docs/specs/S07-roles.md` — роли admin/employee, invite-процесс, первый запуск
- `docs/specs/S00-design-system.md` — токены цветов, touch targets ≥ 64px, анимации spring 250ms

**Код из предыдущих сессий:**
- `src/data/supabase.ts` — `supabase` клиент
- `src/data/store.ts` — `useAppStore`: `isOnline`, `userId`, `userRole`, `activeSessionId`, `setUser`, `clearUser`, `setOnline`, `setActiveSession`
- `src/data/db.ts` — Dexie db, типы: `UserProfile`, `Session`
- `src/data/sync.ts` — `initialLoad()`, `checkOnline()`
- `src/data/database.types.ts` — `Tables<T>`, `Enums<T>`

**Скиллы для этой сессии:**
- Перед написанием компонентов: вызови `/ui-ux-pro-max`
- Если баг не решается за 2 попытки: вызови `/superpowers:systematic-debugging`
- В конце: `/superpowers:finishing-a-development-branch`, затем `/superpowers:verification-before-completion`

---

## Цель сессии

Приложение входит в аккаунт, показывает Главную с правильным таббаром по роли. При входе в сессию таббар анимированно морфится в сессионный режим.

---

## Навигационная архитектура (источник: S14)

### Концепция: два режима таббара

| Роль | Домашний режим | Сессионный режим |
|------|---------------|-----------------|
| Employee | `[Главная]` | `[Главная · Стеллаж · Заявка · Чеклист]` |
| Admin | `[Главная · Стеллаж⚙ · Каталог]` | `[Главная · Стеллаж · Заявка · Чеклист]` |

**Переход домашний → сессионный:** "Начать обход" / "Продолжить →" → навигация + морфинг.
**Переход сессионный → домашний:** тап "Главная" → navigate('/app/home') + морфинг.
**← никогда не меняет статус сессии** — только навигирует.

### Маршруты

```
/                          → RedirectByAuth
/login                     → LoginPage
/onboarding                → OnboardingPage

/app                       → AppShell (auth guard)
  /app/home                → HomePage (заглушка "I-06", это и есть Главная/менеджер сессий)
  /app/shelf               → ShelfPage (заглушка "I-04/I-05", сессионный режим)
  /app/order               → OrderDraftPage (заглушка "I-05")
  /app/checklist/:sessionId → ChecklistPage (заглушка "I-06")
  /app/session/:id         → SessionDetailPage (заглушка "I-06")
  /app/shelf-config        → ShelfConfigPage (заглушка "I-04", admin домашний режим)
  /app/catalog             → CatalogPage (заглушка "I-07", admin домашний режим)
  /app/settings            → SettingsPage (admin only)
  /app/settings/users      → UsersPage (admin only)
  /app/settings/audit      → AuditPage (заглушка "I-07", admin only)
  /app/stock-entry/:cellId → StockEntryPage (заглушка "I-05")
```

**RedirectByAuth:** нет сессии → `/login`; первый запуск → `/onboarding`; залогинен → `/app/home`.

**Защита:** `/app/shelf-config`, `/app/catalog`, `/app/settings/*` — только admin → иначе redirect `/app/home`.

---

## Задачи

### 1. `src/app/router.tsx`

React Router 7, SPA-режим. Все маршруты из списка выше. Использовать `createBrowserRouter`.

### 2. `src/app/useAuth.ts`

```typescript
export function useAuth(): {
  session: Session | null
  userProfile: UserProfile | null
  isLoading: boolean
}
```

- `supabase.auth.onAuthStateChange()` → при логине загружает профиль из `user_profiles`
- Пишет в Dexie: `db.user_profiles.put(profile)`
- `store.setUser(id, role)` при логине; `store.clearUser()` при выходе

### 3. `src/features/auth/LoginPage.tsx`

- react-hook-form + zod: email + пароль
- Кнопка "Войти" 56px, `--primary`
- "Забыл пароль?" → `supabase.auth.resetPasswordForEmail(email)` + toast
- Ошибка → toast русским текстом

### 4. `src/features/auth/OnboardingPage.tsx`

Форма создания первого admin (Имя, Email, Пароль мин. 8 символов).

**Определить первый запуск:**
```typescript
// POST к create-first-admin с пустым {}
// 409 / { alreadyExists: true } → /login
// 200 → показать форму
```

После создания: `signInWithPassword` → navigate('/app/home').

### 5. `src/app/AppShell.tsx`

- Проверяет auth: loading → skeleton; нет сессии → /login
- `initialLoad()` один раз при монтировании
- `navigator.onLine` listener → `store.setOnline()`
- Рендерит `<AppLayout />` + `<Outlet />`

### 6. `src/app/AppLayout.tsx`

Единый layout для обеих ролей — header + content + морфящийся таббар:

```
┌──────────────────────────────────┐
│ CELL        [OfflineIndicator] ⚙️│  ← 56px header
├──────────────────────────────────┤
│                                  │
│           <Outlet />             │
│                                  │
├──────────────────────────────────┤
│    [морфящийся BottomNav]        │  ← 64px
└──────────────────────────────────┘
```

### 7. `src/app/BottomNav.tsx` — морфинг

Ключевой компонент. Два набора вкладок: домашний и сессионный.

```typescript
type NavMode = 'home-employee' | 'home-admin' | 'session'

// Определение режима:
// session mode = useAppStore().isSessionMode (см. ниже)
// home-admin = userRole === 'admin' && !isSessionMode
// home-employee = userRole === 'employee' && !isSessionMode
```

**Домашние вкладки:**

Employee: `[{ label: 'Главная', icon: Home, to: '/app/home' }]`

Admin: `[
  { label: 'Главная', icon: Home, to: '/app/home' },
  { label: 'Стеллаж', icon: Warehouse, to: '/app/shelf-config' },
  { label: 'Каталог', icon: Package, to: '/app/catalog' },
]`

**Сессионные вкладки (обе роли):**
```typescript
[
  { label: 'Главная', icon: Home, to: '/app/home' },
  { label: 'Стеллаж', icon: LayoutGrid, to: '/app/shelf' },
  { label: 'Заявка',  icon: FileText, to: '/app/order',  disabled: ... },
  { label: 'Чеклист', icon: ClipboardList, to: '/app/checklist/<activeSessionId>', disabled: ... },
]
```

Disabled логика:
- Заявка: `session.status === 'sweeping'` или `session.status === 'fulfilling'`
- Чеклист: `session.status !== 'fulfilling'`

**Морфинг анимация (Motion v12):**
```typescript
import { AnimatePresence, motion } from 'motion/react'

// При смене режима — AnimatePresence переключает наборы вкладок:
// Новые вкладки: x: 40 → 0, opacity: 0 → 1, spring 250ms
// Уходящие: x: 0 → -40, opacity: 1 → 0
```

**Тап "Главная" в сессионном режиме:**
```typescript
if (isSessionMode && tab.to === '/app/home') {
  store.setSessionMode(false)
  navigate('/app/home')
  return
}
```

### 8. `src/data/store.ts` — добавить isSessionMode

В Zustand store добавить:
```typescript
isSessionMode: boolean
setSessionMode: (v: boolean) => void
```

`isSessionMode = true` выставляется при нажатии "Начать обход" / "Продолжить →".
`isSessionMode = false` при тапе на "Главная" в сессионном таббаре.

### 9. `src/app/OfflineIndicator.tsx`

В header между "CELL" и ⚙️. Состояния из `useAppStore`.

| `isOnline` | `isSyncing` | `syncQueueLength` | Показывает |
|:---:|:---:|:---:|---|
| true | false | 0 | — |
| true | true | any | ↻ "Синхронизация..." |
| false | — | 0 | ● "Офлайн" |
| false | — | >0 | ● "Офлайн · N записей" |

После восстановления: зелёная ● "Снова онлайн", 3 сек.

### 10. `src/app/SettingsBottomSheet.tsx` (employee)

shadcn Sheet, side="bottom":
```
Тема: ● Светлая  ○ Тёмная  ○ OLED
[Выйти из аккаунта]
```

### 11. `src/features/admin/SettingsPage.tsx` (admin, /app/settings)

```
← Настройки
  Аккаунты              →
  Журнал действий       →
  ─────────────────────
  Тема: ● Светлая  ○ Тёмная  ○ OLED
  ─────────────────────
  Иван · admin
  [Выйти из аккаунта]
```

### 12. `src/app/ThemeProvider.tsx`

```typescript
export function useTheme(): { theme: 'light' | 'dark' | 'oled'; setTheme: (t) => void }
// localStorage.getItem('cell-theme') ?? 'light'
// document.documentElement.setAttribute('data-theme', theme)
```

### 13. `src/features/admin/UsersPage.tsx`

- `useLiveQuery(() => db.user_profiles.toArray())`
- "+ Добавить" → Dialog → POST `create-user` Edge Function
- Блокировка/разблокировка: optimistic Dexie → Supabase

### 14. Заглушки всех остальных экранов

Минимальный компонент с текстом, чтобы роутинг работал:

| Файл | Текст |
|------|-------|
| `src/features/home/HomePage.tsx` | "Главная (I-06)" |
| `src/features/shelf/ShelfPage.tsx` | "Стеллаж — обход (I-04/I-05)" |
| `src/features/order/OrderDraftPage.tsx` | "Черновик заявки (I-05)" |
| `src/features/checklist/ChecklistPage.tsx` | "Чеклист (I-06)" |
| `src/features/home/SessionDetailPage.tsx` | "Детали сессии (I-06)" |
| `src/features/shelf/ShelfConfigPage.tsx` | "Настройка стеллажа (I-04)" |
| `src/features/catalog/CatalogPage.tsx` | "Каталог (I-07)" |
| `src/features/admin/AuditPage.tsx` | "Журнал действий (I-07)" |
| `src/features/stock/StockEntryPage.tsx` | "Ввод остатка (I-05)" |

### 15. Исправление схемы I-02

Проверить через `execute_sql`:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_entries';
SELECT column_name FROM information_schema.columns WHERE table_name = 'order_lines';
```

Создать `supabase/migrations/005_schema_fixes.sql`:
```sql
-- S04: поле называется value, не quantity
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.columns
    WHERE table_name='stock_entries' AND column_name='quantity')
  THEN ALTER TABLE stock_entries RENAME COLUMN quantity TO value; END IF;
END $$;

-- S08: снимок имени товара в строке заявки
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS product_name TEXT NOT NULL DEFAULT '';

-- S01: предустановленные материалы
INSERT INTO materials (id, name, color, is_custom, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Дерево',   '#D4A574', false, now(), now()),
  (gen_random_uuid(), 'Пластик',  '#64B5F6', false, now(), now()),
  (gen_random_uuid(), 'Металл',   '#9E9E9E', false, now(), now())
ON CONFLICT DO NOTHING;
```

Применить через `mcp__claude_ai_Supabase__apply_migration`.

---

## Не делать в этой сессии

- ShelfGrid компонент — I-04
- StockEntryForm — I-05
- OrderDraftPage реализация — I-05
- ChecklistPage реализация — I-06
- HomePage реализация — I-06
- CatalogPage реализация — I-07

---

## Результат

- [ ] `pnpm build` — 0 ошибок TypeScript
- [ ] `pnpm test` — 28 тестов зелёные
- [ ] `/login` → форма входа
- [ ] Первый запуск → `/onboarding`
- [ ] Вход employee → Главная, таббар `[Главная]`
- [ ] Вход admin → Главная, таббар `[Главная · Стеллаж⚙ · Каталог]`
- [ ] Тап "Начать обход" → таббар анимированно морфится в `[Главная · Стеллаж · Заявка · Чеклист]`
- [ ] Тап "Главная" в сессионном режиме → таббар морфится обратно + navigate('/app/home')
- [ ] Admin ⚙️ → `/app/settings` (полноэкранный)
- [ ] Employee ⚙️ → bottom sheet
- [ ] Тема сохраняется в localStorage
- [ ] `/app/shelf-config` как employee → redirect `/app/home`
- [ ] Офлайн-индикатор работает

---

## Инвентарь для I-04

Создать `docs/sessions/prompts/I-04-shelf-builder.md` (читай PROMPT-GUIDE.md).

**Что обязательно включить:**
1. `src/app/store.ts` — новое поле `isSessionMode` и `setSessionMode()`
2. Как запустить сессионный режим: `store.setSessionMode(true)` + navigate
3. Маршруты: `/app/shelf` (сессионный, view), `/app/shelf-config` (admin, edit)
4. `AppLayout` — точный экспорт, как встраивается Outlet
5. Что исправлено в схеме (результат 005_schema_fixes.sql)
6. Что НЕ сделано: ShelfGrid, CellCard — задача I-04
