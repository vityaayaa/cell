# I-08 — Polish + Deploy

## Контекст

I-01–I-07 завершены: весь функционал реализован. Эта сессия — полировка (анимации, офлайн-режим, PWA), GitHub Actions CI/CD и деплой на Vercel.

---

## Прочитай перед началом

**Спеки:**
- `docs/specs/S09-offline-sync.md` — PWA, Service Worker стратегии, офлайн-очередь, определение связи
- `docs/specs/S10-stack.md` — CI/CD (GitHub Actions), Vercel деплой, vite-plugin-pwa
- `docs/specs/S00-design-system.md` — анимации: 5 правил, конкретные кейсы, OLED-правило, prefers-reduced-motion

**Код из предыдущих сессий:**
- `src/app/OfflineIndicator.tsx` — проверить корректность (написан в I-03)
- `src/data/sync.ts` — `flushQueue()`, `checkOnline()` — использовались ли они полноценно?
- `src/data/store.ts` — `isSyncing`, `syncQueueLength` — обновляются ли?
- `vite.config.ts` — нужно добавить vite-plugin-pwa
- `package.json` — текущие зависимости

**Скиллы для этой сессии:**
- Перед polish-правками: вызови `/ui-ux-pro-max`
- Если баг не решается за 2 попытки: вызови `/superpowers:systematic-debugging`
- В конце: `/superpowers:finishing-a-development-branch`, затем `/superpowers:verification-before-completion`

---

## Цель сессии

Приложение установлено как PWA, работает офлайн (показывает кэш, отправляет очередь при восстановлении), анимации применены везде по S00, CI/CD работает, продакшн-деплой на Vercel сделан.

---

## Задачи

### 1. Установить vite-plugin-pwa

```bash
pnpm add -D vite-plugin-pwa
```

Проверить актуальную версию и синтаксис через Context7 перед установкой.

### 2. Настроить PWA: `vite.config.ts`

```typescript
import { VitePWA } from 'vite-plugin-pwa'

// В plugins:
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
        handler: 'NetworkOnly', // Supabase API — никогда не кэшировать через SW
      },
    ],
  },
  manifest: {
    name: 'CELL — Учёт остатков',
    short_name: 'CELL',
    description: 'Управление стеллажом и заявками на склад',
    theme_color: '#F97316',
    background_color: '#F8FAFC',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
})
```

### 3. Создать иконки PWA

В `public/`:
- `icon-192.png` — 192×192px
- `icon-512.png` — 512×512px
- `icon-maskable-512.png` — с padding для maskable иконки

Простой вариант: оранжевый квадрат с буквой "C" белым цветом (S00: primary = #F97316).

### 4. Полноценный офлайн-режим: доработать `src/data/sync.ts`

Убедиться что `flushQueue()` вызывается при восстановлении связи:

```typescript
// В AppShell.tsx или в отдельном хуке:
useEffect(() => {
  const handleOnline = async () => {
    store.setOnline(true)
    if (await checkOnline()) {
      store.setSyncing(true)
      await flushQueue()
      await initialLoad() // обновить витрину после флаша
      store.setSyncing(false)
      store.setSyncQueueLength(0)
    }
  }
  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}, [])
```

`store.syncQueueLength` должен обновляться при каждой записи в `sync_queue`:

```typescript
// В saveStockEntry, saveChecklistEntry и других write-функциях:
const queueLength = await db.sync_queue.count()
store.setSyncQueueLength(queueLength)
```

Также: `navigator.storage.persist()` при монтировании AppShell (S09).

### 5. Анимации (по правилам S00)

**Проверить и добавить везде где не хватает:**

| Событие | Анимация | Где применить |
|---------|----------|--------------|
| Отметка в чеклисте → конец списка | fade + slide вниз, 150ms | ChecklistRow |
| Сохранение остатка (кнопка Сохранить) | scale 0.97→1.03→1.0, spring | StockEntryPage |
| Переход вперёд | slide: новый экран справа | AppShell / router transitions |
| Переход назад | slide: текущий вправо | — |
| Ошибка валидации | shake, 100ms 2 цикла | StockEntryPage, ProductForm |
| Появление карточки/записи | scale 0.95→1.0 + fade, 200ms | SessionCard, ChecklistRow mount |
| Toast прогресс-бар | убывающая полоска | Toast компонент |

Реализация через Motion v12 (`motion.div`):

```typescript
import { motion, AnimatePresence } from 'motion/react'

// Анимация ячейки чеклиста при отметке:
<AnimatePresence>
  {entry.status === 'pending' && (
    <motion.div
      key={entry.id}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.15 }}
    >
      <ChecklistRow entry={entry} />
    </motion.div>
  )}
</AnimatePresence>
```

**prefers-reduced-motion:**
```typescript
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Передавать в transition: duration: prefersReduced ? 0 : 0.15
```

**OLED-правило (S00):** при теме "oled" — проверить что нет белых вспышек при переходах.

### 6. Toast с прогресс-баром (S00)

Если используется shadcn Sonner — добавить кастомный контент:

```typescript
// src/lib/toast.ts
import { toast as sonnerToast } from 'sonner'
import { motion } from 'motion/react'

export function toastSuccess(message: string, duration = 2000) {
  sonnerToast.custom(
    (t) => (
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {message}
        <motion.div
          style={{ position: 'absolute', bottom: 0, left: 0, height: 3, background: '#10B981' }}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
        />
      </div>
    ),
    { duration }
  )
}
```

### 7. Навигационные переходы

Добавить slide-анимации между экранами:

```typescript
// src/app/PageTransition.tsx
import { motion, AnimatePresence } from 'motion/react'
import { useLocation } from 'react-router'

const variants = {
  enter: { x: '100%', opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: '-100%', opacity: 0 },
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.2, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

Обернуть `<Outlet />` в AppShell.

### 8. GitHub Actions CI/CD: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test --run
      - run: pnpm build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

### 9. Vercel деплой

Использовать Vercel MCP (`mcp__claude_ai_Vercel__deploy_to_vercel`) или CLI:

```bash
# Проверить актуальный синтаксис через Context7 или Vercel MCP
```

**Переменные окружения в Vercel:**
- `VITE_SUPABASE_URL` — URL Supabase проекта
- `VITE_SUPABASE_ANON_KEY` — anon key

Убедиться что в vercel.json настроен SPA rewrite:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 10. Финальные проверки

- [ ] Открыть на мобильном: тест touch targets ≥ 64px везде
- [ ] Потерять связь и восстановить: офлайн-очередь отправляется
- [ ] Переключить все 3 темы: Light/Dark/OLED — нет белых вспышек
- [ ] Установить как PWA (Android): иконка на рабочем столе
- [ ] `pnpm test --run` → все тесты зелёные
- [ ] `pnpm build` → сборка без ошибок

---

## Не делать в этой сессии

- Новый функционал (всё должно быть в I-01–I-07)
- Рефакторинг архитектуры
- e2e тесты (Playwright) — отклонено в S10

---

## Результат

- [ ] PWA: приложение устанавливается на экран телефона
- [ ] Офлайн: при потере связи показывает кэш, пишет в очередь
- [ ] Синхронизация: при восстановлении связи очередь уходит на сервер
- [ ] Анимации: все 7 кейсов из S00 реализованы
- [ ] prefers-reduced-motion: анимации отключаются при системной настройке
- [ ] Toast с прогресс-баром: работает в StockEntryPage, ChecklistPage, других местах
- [ ] GitHub Actions: push → typecheck + test + build без ошибок
- [ ] Vercel: продакшн-деплой работает, HTTPS, мобильный браузер открывает без ошибок
- [ ] `pnpm test` — все тесты зелёные в финале
