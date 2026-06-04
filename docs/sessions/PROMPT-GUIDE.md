# CELL — Инструкция по написанию промптов реализации

Все промпты I-01–I-08 уже написаны заранее (`docs/sessions/prompts/`).
Задача каждой сессии в конце — **добавить инвентарь** в промпт следующей сессии.

---

## Зачем добавлять инвентарь

Следующая сессия открывается в чистом контексте — она ничего не знает о предыдущих.
Промпт содержит план задач, но не знает что реально было построено: какие имена у файлов, какие сигнатуры у функций, что пошло не так.
Инвентарь заполняет этот пробел — следующая сессия не тратит время на разведку.

---

## Что делать в конце сессии

Промпт следующей сессии уже существует. Не переписывай его — только **добавь раздел инвентаря** в начало файла (после `## Контекст`, перед `## Прочитай перед началом`).

Назови раздел: `### Создано в I-0N (инвентарь)`

Включи:
1. **Файлы и экспорты**: все новые файлы с ключевыми функциями, типами, компонентами
2. **Ключевые решения**: что сделано иначе чем в спеке — написать явно
3. **Конфигурация**: новые env-переменные, примечания к tsconfig/vite
4. **Подводные камни**: что пошло не так, что нужно учитывать
5. **Точные импорты**: `import { X } from '@/domain/capacity'` — чтобы не угадывать
6. **Что НЕ сделано**: если что-то из плана не влезло

**Пример:**
```markdown
### Создано в I-03 (инвентарь)

**`src/app/BottomNav.tsx`** — `export function BottomNav()`.
Морфинг через AnimatePresence. Читает `isSessionMode` из store.

**`src/data/store.ts`** — добавлено поле `isSessionMode: boolean`, экшен `setSessionMode(v)`.

**Ключевые решения:**
- SettingsPage вынесена вне AppLayout (без header/BottomNav)
- `supabase.functions.invoke()` вместо fetch для Edge Functions

**Команды:**
- `pnpm build` — 0 ошибок ✓
- `pnpm test` — 28 тестов ✓

**Что НЕ сделано:** ShelfGrid — задача I-04.
```

---

## Скиллы и плагины

Каждый промпт должен явно указывать какие скиллы вызывать и когда.
Не добавляй скилл "на всякий случай" — только если уверен что он даёт ценность.

### Таблица по сессиям

| Сессия | Скиллы |
|--------|--------|
| I-01 Setup + Domain | `superpowers:test-driven-development` · `superpowers:finishing-a-development-branch` · `superpowers:verification-before-completion` |
| I-02 Backend | `superpowers:finishing-a-development-branch` · `superpowers:verification-before-completion` |
| I-03 Auth + Shell | `ui-ux-pro-max` · `superpowers:finishing-a-development-branch` · `superpowers:verification-before-completion` |
| I-04 Shelf Builder | `superpowers:brainstorming`¹ · `ui-ux-pro-max` · `frontend-design` · `superpowers:subagent-driven-development`² · `superpowers:finishing-a-development-branch` · `superpowers:verification-before-completion` |
| I-05 Sweep + Order | `ui-ux-pro-max` · `superpowers:subagent-driven-development`² · `superpowers:finishing-a-development-branch` · `superpowers:verification-before-completion` |
| I-06 Checklist + Sessions | `ui-ux-pro-max` · `superpowers:subagent-driven-development`² · `superpowers:finishing-a-development-branch` · `superpowers:verification-before-completion` |
| I-07 Catalog + Admin | `ui-ux-pro-max` · `superpowers:finishing-a-development-branch` · `superpowers:verification-before-completion` |
| I-08 Deploy | `superpowers:finishing-a-development-branch` · `superpowers:verification-before-completion` |

**Везде, условно:** `superpowers:systematic-debugging` — вызвать если баг не решается за 2 попытки.

¹ `brainstorming` — только если есть реальная архитектурная неопределённость (как именно реализовать, а не что делает компонент — это в спеках).
² `subagent-driven-development` — только если сессия тяжёлая и части явно независимы.

### Что делает каждый скилл

| Скилл | Когда полезен |
|-------|--------------|
| `ui-ux-pro-max` | Знает shadcn/ui, Tailwind, мобильные UX-паттерны, touch targets. Вызывать перед написанием UI-компонентов. |
| `frontend-design` | React-архитектура компонентов, composition patterns. Только для сложных компонентов (ShelfGrid). |
| `superpowers:brainstorming` | Перед архитектурными решениями с неопределённостью реализации. НЕ для того что уже описано в спеке. |
| `superpowers:test-driven-development` | Тест сначала, потом код. Обязателен для критичной логики (формулы, синхронизация). |
| `superpowers:systematic-debugging` | Условный. Вызвать когда баг не решается за 2 самостоятельных попытки. |
| `superpowers:subagent-driven-development` | Параллельная реализация независимых частей в одной сессии. Для тяжёлых сессий (I-04, I-05, I-06). |
| `superpowers:finishing-a-development-branch` | Чистое завершение сессии: проверки, коммит, итог. В конце каждой сессии. |
| `superpowers:verification-before-completion` | Принудительная проверка "всё ли сделано" перед закрытием. В каждой сессии после `finishing-a-development-branch`. |

### Как писать в промпте

Добавить в конец раздела "Прочитай перед началом":

```markdown
**Скиллы для этой сессии:**
- Перед написанием UI-компонентов: вызови `/ui-ux-pro-max`
  (shadcn/ui, Tailwind, mobile-first, touch targets ≥ 64px из S00)
- Если баг не решается за 2 попытки: вызови `/superpowers:systematic-debugging`
- В конце сессии: вызови `/superpowers:finishing-a-development-branch`, затем `/superpowers:verification-before-completion`
```

Для сессий без UI (I-01, I-02):
```markdown
**Скиллы для этой сессии:**
- Перед реализацией критичной логики: вызови `/superpowers:test-driven-development`
- Если баг не решается за 2 попытки: вызови `/superpowers:systematic-debugging`
- В конце: `/superpowers:finishing-a-development-branch`, затем `/superpowers:verification-before-completion`
```

Для I-04 (дополнительно):
```markdown
- Перед архитектурой ShelfGrid компонента: вызови `/superpowers:brainstorming`
  (только для решения "как реализовать" — не для "что делает", это в S11)
- Если сессия длинная и части независимы: вызови `/superpowers:subagent-driven-development`
```

---

## Правила для раздела «Прочитай перед началом»

**Спеки:** только те файлы, которые реально нужны. Не "читай всё" — это трата контекста.

| Если сессия делает... | Читать |
|----------------------|--------|
| UI компонент | S00 (дизайн), спека этого экрана |
| Доменную логику | Только спеки с формулами |
| Supabase схему | S01–S07 (модели данных), S09 (updated_at), S10 |
| Синхронизацию | S09, S10 |
| Auth / навигацию | S07, S14 |

**Код из предыдущих сессий:** конкретные файлы, не папки.
- ✓ `src/domain/capacity.ts` — нужны типы CellDimensions и функция getEffectiveCapacity
- ✗ `src/domain/` — слишком широко, тратит контекст

---

## Правила для раздела «Задачи»

- Каждая задача — конкретное действие с конкретным результатом
- Указывать точный путь файла: `src/features/shelf/ShelfGrid.tsx`, не "создай компонент"
- Указывать сигнатуры ключевых функций если они важны для интеграции
- Разбивать на блоки по 3–7 задач (не 20 одним списком)

---

## Правила для раздела «Не делать»

Явный список того, что НЕ входит в эту сессию.
Без этого Claude будет реализовывать лишнее.

---

## Что включать в инвентарь созданного

В конце сессии, до написания промпта следующей:
1. Запустить `find src -type f -name "*.ts" -o -name "*.tsx" | sort` — список всех файлов
2. Для каждого нового файла: записать ключевые экспорты (2–5 штук максимум)
3. Записать любые решения принятые "на ходу" вне спек (например: "использовали tanstack/query вместо ручного fetch")
4. Записать точные команды которые должны работать (`pnpm dev`, `pnpm test`, `supabase db push` и т.д.)

---

## Пример хорошего инвентаря

```markdown
### Создано в I-01:

**src/domain/capacity.ts**
- `type CellDimensions = { computed_width_mm: number; computed_height_mm: number }`
- `type ProductUnit = { width_mm: number; height_mm: number; type: 'unit' }`
- `function getEffectiveCapacity(cell, product, rotation_allowed, override): number`

**src/domain/request.ts**
- `function buildOrderLines(cellsWithStock: CellStock[]): OrderLineInput[]`
  — принимает массив {cell, product, stock, capacity}, возвращает строки заявки
- `type OrderLineInput = { product_id, quantity_packs, deficit_units, is_boundary, is_manual }`

**Решения отличающиеся от спек:**
- В S02 написано `integer` для computed_mm, реализовали как `number` в TS (JS не различает)
- Тест rotation: S03 говорит "поворот на 90°" — реализован как swap(width, height)

**Команды:**
- `pnpm test` — 24 теста, все зелёные
- `pnpm dev` — dev-сервер на :5173

**Что не сделано:**
- Компонент ShelfGrid (I-04)
- Dexie-схема (I-02)
```

---

## Частые ошибки

| Ошибка | Почему плохо | Как правильно |
|--------|-------------|---------------|
| "Прочитай всё в src/" | Тратит весь контекст на код, не остаётся на задачи | Перечисли 3–5 конкретных файлов |
| "Продолжи делать фичу X" | Следующий Claude не знает что было сделано | Напиши точно: что сделано, что осталось, где остановился |
| Не указывать имена экспортов | Следующий Claude придумывает имена сам | Дать точные: `import { buildOrderLines } from '@/domain/request'` |
| Писать промпт в начале сессии | Промпт должен отражать реальный результат, не план | Писать в конце, после всей работы |
