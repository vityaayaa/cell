# CELL — План сессий

---

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

Каждая сессия — отдельный чат.
Промпты: `docs/sessions/prompts/I-0N-*.md`.
Как писать следующий промпт — см. `docs/sessions/PROMPT-GUIDE.md`.

| # | Тема | Промпт | Читать спеки |
|---|------|--------|--------------|
| I-01 | Setup + Domain Core | [I-01](prompts/I-01-setup-domain.md) | S00, S01, S02, S03, S05, S10 |
| I-02 | Backend (Supabase + Data Layer) | [I-02](prompts/I-02-backend.md) | S01–S07, S09, S10 |
| I-03 | Auth + App Shell | [I-03](prompts/I-03-auth-shell.md) | S00, S07, S14 |
| I-04 | Shelf Builder | [I-04](prompts/I-04-shelf.md) | S00, S01, S02, S03, S11 |
| I-05 | Sweep + Order | [I-05](prompts/I-05-sweep-order.md) | S00, S04, S05, S11, S12, S13 |
| I-06 | Checklist + Sessions screen | [I-06](prompts/I-06-checklist-sessions.md) | S00, S05, S06, S08, S13, S14 |
| I-07 | Catalog + Admin | [I-07](prompts/I-07-catalog-admin.md) | S00, S01, S07 |
| I-08 | Polish + Deploy | [I-08](prompts/I-08-deploy.md) | S09, S10 |

### Зависимости

```
I-01 (setup + domain)
  └── I-02 (backend) ←── можно параллельно с I-01
       └── I-03 (shell) ←── нужны I-01 + I-02
            ├── I-04 (shelf)    ←── нужны I-01..I-03
            ├── I-05 (sweep)    ←── нужны I-01..I-04
            ├── I-06 (checklist)←── нужны I-01..I-05
            ├── I-07 (catalog)  ←── нужны I-01..I-03
            └── I-08 (deploy)   ←── нужны I-01..I-07
```

I-04, I-05, I-06, I-07 можно частично параллелить если разные люди/агенты.
