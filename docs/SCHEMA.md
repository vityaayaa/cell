# Снимок схемы БД (CELL)

Итоговая форма таблиц после всех миграций (001–013). Это НЕ история изменений —
здесь только то, как таблицы выглядят сейчас. Источник правды — Supabase
(Postgres); Dexie (IndexedDB) держит локальный кэш тех же таблиц + свою
служебную `sync_queue`.

Общее для почти всех таблиц: `id uuid` (первичный ключ), `created_at`,
`updated_at` (обновляется триггером `set_updated_at` при каждом UPDATE).

---

## materials — материалы (Дерево, Пластик, Металл…)

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid | PK |
| name | text | обязательно |
| color | text | HEX-цвет для точки в списке |
| is_custom | boolean | false = встроенный (нельзя удалить), true = добавлен админом |
| created_at / updated_at | timestamptz | |

Доступ: читать всем, писать — только админ.

## groups — группы товаров (вид: Брусок, Наличник, Вагонка…)

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid | PK |
| name | text | обязательно |
| created_at / updated_at | timestamptz | |

Как materials, но без цвета. Назначение товара в группу обязательно (см.
products.group_id). Доступ: читать всем, писать — админ.

## products — товары

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid | PK |
| name | text | обязательно |
| type | enum product_type | `unit` (штучный, ширина×высота), `round` (круглый, диаметр), `bulk` (навалом/сыпучий) |
| material_id | uuid → materials | обязательно |
| group_id | uuid → groups | **обязательно** (ON DELETE RESTRICT: группу с товарами удалить нельзя) |
| pack_size | integer > 0 | штук в пачке |
| width_mm | numeric | дробные мм; для unit/bulk |
| height_mm | numeric | дробные мм; для unit/bulk |
| length_mm | numeric | дробные мм; для unit/round/bulk |
| diameter_mm | numeric | дробные мм; только для round |
| created_at / updated_at | timestamptz | |

ВАЖНО: размеры (width/height/length/diameter) — **numeric** (дробные мм, миграция
010), например 12.5. Счётные поля (pack_size, capacity_override) остаются integer.
Колонки `count_pieces` НЕТ (была в 009, удалена в 011 — режим ввода теперь
жёстко задан типом: unit и round считаются поштучно, bulk — слайдером).
Доступ: читать всем, писать — админ.

## shelves — стеллажи

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid | PK |
| name | text | |
| rows_count | integer > 0 | число рядов |
| cols_count | integer > 0 | число столбцов |
| created_at / updated_at | timestamptz | |

Обычно ОДИН стеллаж. Доступ: читать всем, писать — админ.

## cells — ячейки (ПЛОСКАЯ N-арная модель, не BSP!)

Модель изменена в миграции 008: раньше было бинарное дерево (is_first_child +
split_ratio), теперь — **плоские равные деления** через `child_index`. Никаких
долей/пропорций.

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid | PK |
| shelf_id | uuid → shelves | ON DELETE CASCADE |
| parent_id | uuid → cells | null у корневых; ON DELETE CASCADE |
| split_direction | enum ('H','V') | у РАЗДЕЛЁННОЙ ячейки: направление деления; null у листа |
| child_index | integer | порядковый номер ребёнка внутри родителя (0-based); null у корневой |
| row_index / col_index | integer | адрес корневой ячейки в сетке |
| width_mm / height_mm | numeric | введённые размеры ячейки (дробные мм) |
| computed_width_mm / computed_height_mm | numeric | итоговые размеры для расчёта вместимости |
| product_id | uuid → products | назначенный товар; ON DELETE SET NULL; null у пустой/разделённой |
| capacity_override | integer | ручное переопределение вместимости (перекрывает расчёт) |
| rotation_allowed | boolean | учитывать поворот товара (50×100 → 100×50) |
| needs_review | boolean | «требует проверки» после изменения размеров/состава |
| created_at / updated_at | timestamptz | |

Столбцов `is_first_child` и `split_ratio` больше НЕТ (удалены в 008).
Лист = ячейка без детей (никто не ссылается на неё через parent_id). Товар
назначается только листу. Доступ: читать всем, писать — админ.

## user_profiles — профили (расширяют auth.users)

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid → auth.users | PK; ON DELETE CASCADE |
| name | text | обязательно |
| role | enum ('admin','employee') | |
| is_active | boolean | активен ли аккаунт |
| created_by | uuid → user_profiles | кто создал |
| created_at / updated_at | timestamptz | |

Доступ: читать всем authenticated. Insert/update/delete — только через Edge
Functions (service role): create-user, delete-user, create-first-admin. Прямой
записи из клиента нет.

## sessions — обходы

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid | PK |
| user_id | uuid → auth.users | чей обход |
| started_at | timestamptz | |
| finished_at | timestamptz | заполняется при completed/abandoned |
| status | enum session_status | `sweeping` → `ordering` → `fulfilling` → `completed`; либо `abandoned` |
| created_at / updated_at | timestamptz | |

Бизнес-правило: один активный обход в системе за раз. Доступ: свой обход + админ.

## stock_entries — замеры остатков (append-only, БЕЗ updated_at)

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid | PK |
| session_id | uuid → sessions | ON DELETE CASCADE |
| cell_id | uuid → cells | ON DELETE CASCADE (миграция 005) |
| user_id | uuid → auth.users | |
| value | integer ≥ 0 | остаток (штук или пачек — по типу товара) |
| created_at | timestamptz | |

Журнал, только добавление. Актуальный остаток ячейки = последняя запись по
created_at. Доступ: insert/select своих + админ (update/delete нет).

## orders — заявки

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid | PK |
| session_id | uuid → sessions | ON DELETE CASCADE |
| finalized_at | timestamptz | null у черновика; заполняется при финализации |
| created_at / updated_at | timestamptz | |

Одна заявка на обход. Доступ: через владение сессией.

## order_lines — позиции заявки

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid | PK |
| order_id | uuid → orders | ON DELETE CASCADE |
| product_id | uuid → products | |
| product_name | text | снимок имени на момент заявки (в БД — см. клиентские записи) |
| quantity_packs | integer ≥ 0 | сколько пачек заказать |
| quantity_units | integer ≥ 0 | сколько штук |
| deficit_units | integer | дефицит (штук); null у ручных позиций |
| is_manual | boolean | добавлена вручную |
| is_boundary | boolean | «граничная» позиция (дефицит < пачки) |
| created_at / updated_at | timestamptz | |

Доступ: через orders → sessions.

## checklist_entries — чеклист погрузки

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid | PK |
| order_line_id | uuid → order_lines | ON DELETE CASCADE |
| status | enum ('pending','done','unavailable') | |
| actual_packs | integer | сколько реально взяли |
| user_id | uuid → auth.users | |
| updated_at | timestamptz | (без created_at) |

Доступ: через order_lines → orders → sessions.

## audit_log — история действий (пишет КЛИЕНТ)

| Колонка | Тип | Заметки |
|---|---|---|
| id | uuid | PK |
| actor_id | uuid → user_profiles | кто сделал (= auth.uid при записи) |
| event_type | text | человекочитаемое: `product_created`, `material_updated`, `group_deleted` и т.п. |
| entity_type | text | `product` / `material` / `group` / … |
| entity_id | uuid | id затронутой сущности |
| old_value / new_value | jsonb | краткий снимок (обычно `{ name }`) |
| created_at | timestamptz | |

ВАЖНО (миграция 013): аудит пишет КЛИЕНТ осмысленными событиями. Серверные
триггеры аудита убраны — они дублировали сухими INSERT/UPDATE/DELETE, которые
экран истории показать по-человечески не умел. Доступ: insert (только от своего
имени, actor_id = auth.uid), select — только админ.

## sync_queue — очередь досылки (ТОЛЬКО Dexie, в Postgres её нет)

Локальная страховка офлайна. Неудавшиеся записи (нет связи/таймаут/ошибка)
кладутся сюда и досылаются при восстановлении связи (`flushQueue`).

| Колонка | Тип | Заметки |
|---|---|---|
| id | string (uuid) | PK записи очереди |
| table_name | string | целевая таблица |
| record_id | string | id записи данных |
| operation | 'upsert' \| 'delete' | тип операции при досылке |
| payload | object | полная запись (для upsert) |
| created_at | string (ISO) | для FIFO-порядка досылки |
| retry_count | number | счётчик попыток; при ≥ 5 запись пропускается (защита от вечного ретрая) |
