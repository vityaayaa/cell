# Где искать инструменты и решения

Это не список конкретных библиотек — это инструкция по поиску. Список устаревает при первом новом требовании. Инструкция работает всегда.

---

## Локальные ресурсы (уже склонированы)

```
/tmp/cell-research/awesome-selfhosted/   — открытые приложения по категориям
/tmp/cell-research/public-apis/          — бесплатные публичные API
/tmp/cell-research/system-design-primer/ — архитектурные паттерны
```

Поиск по локальным репо:
```bash
grep -i -n "<ключевое слово>" /tmp/cell-research/awesome-selfhosted/README.md
grep -i -n "<ключевое слово>" /tmp/cell-research/public-apis/README.md
grep -i -n "<тема>" /tmp/cell-research/system-design-primer/README.md
```

Разделы awesome-selfhosted, которые актуальны для CELL:
- `Inventory Management` — прямые аналоги (их код — источник паттернов)
- `Resource Planning` — ERP с inventory-модулем
- `Money, Budgeting & Management` — если понадобится финансовая часть

---

## Справочные реализации (изучить при проектировании)

- **InvenTree** (github.com/inventree/InvenTree) — MIT, Python. Лучшая открытая система управления частями и запасами. Изучить: модель Part/StockItem/StockLocation, параметры.
- **Shelf.nu** (github.com/Shelf-nu/shelf.nu) — AGPL, Node.js/Remix. Asset tracking с QR-кодами и location tree. Близко по духу к CELL.
- **grocy** (github.com/grocy/grocy) — MIT, PHP. ERP для дома/малого бизнеса. Простая модель, хорошее UX для мобильных.
- **Open QuarterMaster** (github.com/Epic-Breakfast-Productions/OpenQuarterMaster) — GPL, Java. Warehouse management с гибкими storage units.
- **System Design Primer** (github.com/donnemartin/system-design-primer) — для паттернов offline/sync/cache в S09/S10.

---

## Инструменты поиска

| Инструмент | Когда использовать |
|------------|-------------------|
| **Exa** | Best practices, community опыт, "почему X плохо", аналоги, сравнения |
| **Context7** | Версии, синтаксис API, документация конкретной библиотеки |
| **GitHub MCP** | Примеры реализаций, архитектурные решения в реальных проектах |
| **Supabase MCP** | Только когда схема зафиксирована (не раньше S10) |
| **Vercel MCP** | Только на этапе деплоя |

### Запросы в Exa
- `"<задача> best practices mobile app 2025"` — актуальный опыт
- `"<задача> common mistakes pitfalls"` — чего избегать
- `"<библиотека/подход> problems when not to use"` — критика

### Процесс поиска при новых требованиях

1. Сформулируй ключевые слова на английском (inventory, warehouse, offline, sync...)
2. Поищи в локальных репо (grep)
3. Поищи через Exa: best practices + common mistakes
4. Если нужна конкретная библиотека — Context7 для документации, GitHub MCP для примеров
5. Если нашёл кандидата — поищи через Exa: `"<название> problems"` и `"<название> alternatives"`
