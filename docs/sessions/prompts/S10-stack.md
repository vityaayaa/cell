# Сессия S10 — Стек и архитектура

## Прочитай перед началом

```
CLAUDE.md
docs/specs/S01-catalog.md
docs/specs/S02-shelf-model.md
docs/specs/S03-capacity.md
docs/specs/S04-stock-entry.md
docs/specs/S05-request.md
docs/specs/S06-checklist.md
docs/specs/S07-roles.md
docs/specs/S08-history.md
docs/specs/S09-offline-sync.md
```

---

## Уже закрыто в S07–S09 — не поднимать

- **Бэкенд: Supabase** — выбран в S07. Supabase Auth (email+password), облачная БД, Supabase Realtime.
- **Архитектура синхронизации: online-first** — решено в S09. Supabase — источник правды. IndexedDB — локальный кэш.
- **Локальное хранилище: Dexie.js** — выбран в S09. IndexedDB wrapper для кэша и офлайн-очереди.
- **PWA: vite-plugin-pwa** — выбран в S09. Service Worker с CacheFirst для статики, NetworkFirst для app shell.
- **Realtime-синхронизация: Supabase Realtime** — WebSocket подписки, изменения прилетают мгновенно.
- **Конфликты: Last-Write-Wins** по `updated_at` — решено в S09. CRDT не нужен.
- **Офлайн-очередь** — пишется в IndexedDB, уходит на Supabase при восстановлении связи. Background Sync не используется (нет iOS-поддержки).
- **"Нужен ли бэкенд вообще"** — закрыто в S07.
- **Supabase offline sync limitations** — изучены в S09, ограничения учтены в архитектуре.

---

## Исследование (выполни сам ДО разговора с пользователем)

**Все факты о технологиях — проверять через Context7/Exa. Никаких утверждений из памяти.**

1. **Изучи Shelf.nu** (github.com/Shelf-nu/shelf.nu) — ближайший аналог CELL:
   - Какой стек? (Remix + Prisma + SQLite — проверить актуально ли)
   - Как они реализуют офлайн?
   - Какие решения по архитектуре можно перенять?

2. **Через Context7:** изучи актуальное состояние:
   - `Vite` + `vite-plugin-pwa` — текущая версия, что умеет
   - `React` vs `Svelte` vs `Vue` — для мобильного, offline-heavy, grid-heavy UI
   - `Dexie.js` или `RxDB` — что лучше для нашего кейса (выбор из S09)

3. **Через Exa:** "React vs Svelte 2025 mobile PWA performance comparison"
   - Для мобильного приложения bundle size важен. Реальные сравнения.

4. **Через Exa:** "Supabase offline sync 2025 limitations" — если бэкенд нужен (S09 ответил)
   - Что Supabase умеет и не умеет для offline sync?

5. **System Design Primer** (/tmp/cell-research/system-design-primer):
   - Прочитай секцию про layered architecture и service layer pattern
   - Применимо для нашего app? Frontend → Service Layer → Storage Layer

6. **Поищи через Exa:** "boring technology inventory app stack 2025 maintainability"
   - "Choose boring technology" — принцип. Для небольшого приложения одного магазина что оптимально?

---

## Что принести в разговор

После исследования составь **краткое резюме требований** из S01–S09, которые влияют на стек:

- Офлайн-first (решено в S09)
- Мобильный первичен
- Сложный grid UI (стеллаж с делением ячеек) — тяжёлый UI
- Вычисления (capacity formula) — нужен TypeScript или хотя бы JSDoc
- Одиночный пользователь (или несколько — решено в S07)
- Бэкенд есть/нет (решено в S09)

Затем дай **конкретную рекомендацию стека** (не список вариантов) с обоснованием.

Принеси также то, чего пользователь не думал:

- **TypeScript vs. JavaScript**: для приложения с расчётами и сложными структурами данных TypeScript — не излишество, а защита от ошибок в production.
- **Монорепо или нет**: если бэкенд есть, одна репа для frontend + backend или две? Turborepo/pnpm workspaces — стоит ли?
- **Testing strategy**: хотя бы unit тесты для формулы вместимости (критическая логика). Cypress/Playwright для e2e — нужно ли?
- **CI/CD**: автодеплой при push — настроить с самого начала дешевле, чем добавлять потом.
- **Mobile-specific concerns**: iOS Safari quirks, viewport на мобильном, safe area insets.

---

## Ты — критик: оспорь возможные предположения

1. **"Начнём с React, оно популярное" — хорошая ли причина?**
   Для мобильного PWA с offline-first Svelte даёт меньший bundle, лучше производительность, проще написать. React — не всегда правильный выбор для этого кейса.

2. **"Supabase для всего" — не значит правильно.**
   Supabase — отличный BaaS, но offline sync в нём ограничен. Если S09 решил, что нужен бэкенд, возможно локальный SQLite + простой Express/Fastify API надёжнее и предсказуемее.

3. **Не строй ради возможного будущего.**
   "Вдруг понадобится микросервисная архитектура" — не нужна. Один маленький магазин, один разработчик (или Claude). YAGNI: выбирай стек, который проще поддерживать, а не который масштабируется до миллионов пользователей.

---

## Обсуждение 

1. Представь финальную рекомендацию стека. Объясни каждый элемент + главный trade-off.

2. Покажи верхнеуровневую архитектуру: модули и как они взаимодействуют.

3. Покажи структуру папок проекта (первые 2 уровня). Спроси, понятно ли, правильно ли.

---

## Инструменты в этой сессии

- **Context7** — ОБЯЗАТЕЛЬНО для всех технических фактов: версии, возможности, синтаксис
- **Exa** — сравнения технологий, community feedback
- **GitHub MCP** — изучить Shelf.nu реальный стек
- **Bash** — если нужно прочитать из /tmp/cell-research/

---

## Результат сессии

**Файл:** `docs/specs/S10-stack.md`

```
- Выбранный стек: каждая технология + обоснование + trade-off
- Верхнеуровневая архитектура (текстовая схема модулей)
- Структура папок проекта (2 уровня)
- Testing strategy
- CI/CD plan
- Что намеренно отклонено и почему
- Принятые решения с обоснованием
```
