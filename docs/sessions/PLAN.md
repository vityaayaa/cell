# CELL — План сессий

Каждая сессия — отдельный чат. Промпты лежат в `docs/sessions/prompts/`.
Результат каждой сессии — спецификация в `docs/specs/S{N}-*.md`.
Следующая сессия читает ВСЕ предыдущие спеки + CLAUDE.md.

---

## Фаза 0 — Дизайн-система

| # | Тема | Спека |
|---|------|-------|
| S00 | Дизайн-система (шрифт, цвета, анимации, тач-цели) | docs/specs/S00-design-system.md |

Читается во всех сессиях S11–S14. Не является отдельным чатом — создана до начала UI-сессий.

---

## Фаза 1 — Доменная модель

| # | Тема | Промпт | Спека |
|---|------|--------|-------|
| S01 | Каталог товаров | [S01](prompts/S01-catalog.md) | docs/specs/S01-catalog.md |
| S02 | Модель стеллажа | [S02](prompts/S02-shelf-model.md) | docs/specs/S02-shelf-model.md |
| S03 | Расчёт вместимости | [S03](prompts/S03-capacity.md) | docs/specs/S03-capacity.md |

## Фаза 2 — Бизнес-логика потоков

| # | Тема | Промпт | Спека |
|---|------|--------|-------|
| S04 | Внесение остатков | [S04](prompts/S04-stock-entry.md) | docs/specs/S04-stock-entry.md |
| S05 | Заявка на склад | [S05](prompts/S05-request.md) | docs/specs/S05-request.md |
| S06 | Чеклист | [S06](prompts/S06-checklist.md) | docs/specs/S06-checklist.md |
| S07 | Роли и доступ | [S07](prompts/S07-roles.md) | docs/specs/S07-roles.md |
| S08 | История | [S08](prompts/S08-history.md) | docs/specs/S08-history.md |

## Фаза 3 — Технический фундамент

| # | Тема | Промпт | Спека |
|---|------|--------|-------|
| S09 | Офлайн и синхронизация | [S09](prompts/S09-offline-sync.md) | docs/specs/S09-offline-sync.md |
| S10 | Стек и архитектура | [S10](prompts/S10-stack.md) | docs/specs/S10-stack.md |

## Фаза 4 — Визуал и UX

| # | Тема | Промпт | Спека |
|---|------|--------|-------|
| S11 | UI: Конструктор стеллажа | [S11](prompts/S11-ui-shelf-builder.md) | docs/specs/S11-ui-shelf-builder.md |
| S12 | UI: Внесение остатков | [S12](prompts/S12-ui-stock-entry.md) | docs/specs/S12-ui-stock-entry.md |
| S13 | UI: Заявка и чеклист | [S13](prompts/S13-ui-request-checklist.md) | docs/specs/S13-ui-request-checklist.md |
| S14 | UI: Общий UX и навигация | [S14](prompts/S14-ui-navigation.md) | docs/specs/S14-ui-navigation.md |

---

## Как использовать

1. Открой новый чат Claude Code в папке `/home/vityaayaa/projects/cell`
2. Скопируй содержимое нужного промпта
3. Вставь в чат — Claude прочитает все нужные файлы и начнёт сессию
4. По завершении сессии Claude сохранит спеку в `docs/specs/`
