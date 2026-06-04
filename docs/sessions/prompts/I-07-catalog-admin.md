# I-07 — Catalog + Admin

## Контекст

I-01–I-06 завершены: полный flow обхода работает от начала до конца. Эта сессия — каталог товаров (CRUD для admin), агрегаты по истории, Excel-экспорт и журнал действий. Также — убрать все оставшиеся заглушки admin-разделов.

---

## Прочитай перед началом

**Спеки:**
- `docs/specs/S01-catalog.md` — модели Product и Material, три типа, поля по типу, отображаемое имя
- `docs/specs/S07-roles.md` — управление аккаунтами (уже в I-03), audit log: что логируется, фильтры
- `docs/specs/S08-history.md` — агрегаты по товарам: поля, расчёт, экспорт Excel
- `docs/specs/S00-design-system.md` — токены цветов, формы, валидация

**Код из предыдущих сессий:**
- `src/data/db.ts` — `db.products`, `db.materials`, `db.sessions`, `db.orders`, `db.order_lines`, `db.checklist_entries`  
  ⚠️ `db.audit_log` в схеме **отсутствует** — нужно добавить в db.ts и Supabase migration
- `src/data/supabase.ts` — supabase клиент
- `src/data/store.ts` — `useAppStore()`: `userRole`
- `src/features/home/HomePage.tsx` — основной экран (не SessionsPage); кнопки admin уже добавлены (см. «Уже закрыто»)
- `src/features/home/SessionCard.tsx` — карточка активной сессии
- `src/features/home/SessionDetailPage.tsx` — детали сессии plan vs fact
- `src/features/checklist/saveChecklistEntry.ts` — optimistic write + rollback + autocompletion
- `src/app/router.tsx` — маршруты `/app/catalog`, `/app/settings/audit` (маршрут `/app/admin/aggregates` ещё **не добавлен** — задача 8)

---

## Уже закрыто (не переделывать)

- **`SessionsPage.tsx` не существует.** В I-06 главный экран называется `src/features/home/HomePage.tsx`. Всё, что в I-07 написано про `SessionsPage`, читай как `HomePage`.
- **Кнопки admin на «Главной» (задача 7) — частично готовы:** кнопка "Агрегаты по товарам →" уже делает `navigate('/app/admin/aggregates')`, кнопка "Экспорт Excel ↓" показывает toast-заглушку. В I-07 нужно только подключить реальный `exportAggregatesExcel` к уже существующей кнопке.

**Скиллы для этой сессии:**
- Перед написанием компонентов: вызови `/ui-ux-pro-max`
- Если баг не решается за 2 попытки: вызови `/superpowers:systematic-debugging`
- В конце: `/superpowers:finishing-a-development-branch`, затем `/superpowers:verification-before-completion`

---

## Цель сессии

Admin управляет каталогом товаров, видит агрегаты по всем сессиям, может экспортировать в Excel и просматривать журнал действий. Заглушки `/app/catalog` и `/app/settings/audit` заменены на реальные экраны.

---

## Задачи

### 1. Каталог товаров: `src/features/catalog/CatalogPage.tsx`

Маршрут: `/app/catalog` (admin only, Tab 2).

```
📦 Каталог                      [+ Добавить]

  Дерево  ●  Пластик  ○  Металл  ○
  (фильтр по материалу)

┌──────────────────────────────────────┐
│ Брусок 50×50×3000                    │
│ Дерево · pack: 4 шт                  │
│                               [  ⋯  ]│
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ Труба ПВХ ⌀110×3000                  │
│ Пластик · pack: 1 шт                 │
│                               [  ⋯  ]│
└──────────────────────────────────────┘
```

Данные:
```typescript
const products = useLiveQuery(() => db.products.toArray())
const materials = useLiveQuery(() => db.materials.toArray())
const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)

const filteredProducts = products?.filter(p =>
  selectedMaterialId ? p.material_id === selectedMaterialId : true
) ?? []
```

Отображаемое имя (S01):
```typescript
function getProductDisplayName(product: Product): string {
  if (product.type === 'unit') return `${product.name} ${product.width_mm}×${product.height_mm}×${product.length_mm}`
  if (product.type === 'round') return `${product.name} ⌀${product.diameter_mm}×${product.length_mm}`
  return product.name
}
```

### 2. Форма создания/редактирования товара: `src/features/catalog/ProductForm.tsx`

Открывается в Sheet (bottom sheet) или Dialog при "+ Добавить" / тапе "⋯" на товар.

**Общие поля (для всех типов):**
```
Название: [              ]
Тип:      ○ unit  ○ round  ○ bulk
Материал: [  выбрать ▼  ]
Размер пачки: [  4  ] шт
```

**Дополнительно для unit:**
```
Ширина сечения:  [  50 ] мм
Высота сечения:  [  50 ] мм
Длина:           [3000 ] мм
```

**Дополнительно для round:**
```
Диаметр:  [ 110 ] мм
Длина:    [3000 ] мм
```

**Для bulk:** дополнительных полей нет.

Валидация (zod):
```typescript
const schema = z.object({
  name: z.string().min(1),
  type: z.enum(['unit', 'round', 'bulk']),
  material_id: z.string().uuid(),
  pack_size: z.number().int().positive(),
  width_mm: z.number().int().positive().optional(),
  height_mm: z.number().int().positive().optional(),
  length_mm: z.number().int().positive().optional(),
  diameter_mm: z.number().int().positive().optional(),
})
```

Сохранение:
```typescript
// Optimistic Dexie → Supabase
// При создании: id = crypto.randomUUID() на клиенте
await db.products.put(product)
const { error } = await supabase.from('products').upsert(product)
if (error) { await db.products.delete(product.id); toast.error(...) }
```

Удаление товара:
- Confirm Dialog: "Товар будет удалён из каталога. Ячейки, где он назначен, получат флаг проверки."
- После удаления: сбросить `product_id` со всех ячеек + выставить им `needs_review = true`
```typescript
const { data: assignedCells } = await supabase
  .from('cells').select('id').eq('product_id', productId)
await supabase.from('cells')
  .update({ product_id: null, needs_review: true })
  .in('id', assignedCells.map(c => c.id))
await supabase.from('products').delete().eq('id', productId)
// Синхронизировать Dexie
```

### 3. Управление материалами: `src/features/catalog/MaterialsSection.tsx`

Встроено в CatalogPage (секция снизу или отдельная вкладка).

```
Материалы

  ● Дерево   #D4A574   [✎]
  ● Пластик  #64B5F6   [✎]
  ● Металл   #9E9E9E   [✎]
  ● Алюминий #B0C4DE   [✎] [✕]   ← кастомные можно удалить

[+ Добавить материал]
```

Предустановленные (is_custom = false) — нельзя удалить. Кастомные — можно.

Создание материала: Название + цвет (color picker или hex-input).

### 4. Агрегаты по товарам: `src/features/admin/AggregatesPage.tsx`

Маршрут: `/app/admin/aggregates`.

```
← Агрегаты по товарам       [Экспорт Excel ↓]

  Товар                  В заявке  Ср.пачки  Взяли  Не было
  Брусок 50×50×3000         12       4.2      3.8      1
  Доска 20×100×6000          8       2.0      2.0      0
  Труба ПВХ ⌀110×3000        6       3.5      3.0      2
```

Запрос (на сервер, не из Dexie — агрегаты по всем completed сессиям):

```typescript
// Получить все completed сессии
const { data: completedSessions } = await supabase
  .from('sessions').select('id').eq('status', 'completed')

// Агрегаты через SQL JOIN (Supabase RPC или raw query)
// Или построить на клиенте из Dexie если данных мало
```

Для простоты — строить на клиенте из Dexie:

```typescript
function buildAggregates(sessions: Session[], orders: Order[], orderLines: OrderLine[], entries: ChecklistEntry[]) {
  // Группировать OrderLines по product_name (не product_id: товар мог быть удалён)
  // Для каждого: count, avg quantity_packs, avg actual_packs (где done), count unavailable
}
```

### 5. Excel экспорт: `src/features/admin/exportExcel.ts`

```typescript
import ExcelJS from 'exceljs'

export async function exportAggregatesExcel(aggregates: ProductAggregate[]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Товары')

  sheet.columns = [
    { header: 'Товар', key: 'name', width: 30 },
    { header: 'Раз в заявке', key: 'timesOrdered', width: 15 },
    { header: 'Среднее заказано (пачек)', key: 'avgOrdered', width: 25 },
    { header: 'Среднее взяли (пачек)', key: 'avgTaken', width: 22 },
    { header: 'Раз не было', key: 'timesUnavailable', width: 15 },
  ]

  aggregates.forEach(a => sheet.addRow(a))

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'cell-aggregates.xlsx'; a.click()
  URL.revokeObjectURL(url)
}
```

### 6. Журнал действий: `src/features/admin/AuditPage.tsx`

Маршрут: `/app/settings/audit`.

```
← Журнал действий

  Фильтры: [Все пользователи ▼] [Все категории ▼] [С: ___] [По: ___]

  4 июня, 14:30  Иван
  Товар добавлен: Брусок 50×50×3000

  4 июня, 13:15  Пётр
  Обход начат: сессия #abc123

  4 июня, 12:00  Иван
  Ячейка разделена: A2 → A2(1,1) / A2(1,2)
```

Данные из Dexie:
```typescript
const logs = useLiveQuery(() =>
  db.audit_log
    .filter(l =>
      (!filterUserId || l.actor_id === filterUserId) &&
      (!filterCategory || l.event_category === filterCategory) &&
      (!filterFrom || l.created_at >= filterFrom) &&
      (!filterTo || l.created_at <= filterTo)
    )
    .sortBy('created_at')
    .then(r => r.reverse())
)
```

Человекочитаемое отображение событий (S07):
```typescript
function formatAuditEvent(log: AuditLog): string {
  switch (log.event_type) {
    case 'product_created': return `Товар добавлен: ${log.new_value?.name}`
    case 'product_updated': return `Товар изменён: ${log.entity_id}`
    case 'product_deleted': return `Товар удалён: ${log.old_value?.name}`
    case 'session_started': return `Обход начат`
    case 'session_completed': return `Обход завершён`
    case 'cell_split': return `Ячейка разделена`
    // ... и т.д. по S07
  }
}
```

### 7. Обновить SessionsPage: убрать заглушки агрегатов

```typescript
// Заменить заглушки на реальные navigate:
<Button onClick={() => navigate('/app/admin/aggregates')}>
  Агрегаты по товарам →
</Button>
<Button onClick={() => exportAggregatesExcel(aggregates)}>
  Экспорт Excel ↓
</Button>
```

### 8. Добавить маршруты в router.tsx

```
/app/admin/aggregates  → <AggregatesPage />
```

---

## Не делать в этой сессии

- PWA, Service Worker — I-08
- Анимации полировка — I-08
- CI/CD, Vercel деплой — I-08
- Seed данных для товаров (только материалы уже есть из I-03)

---

## Результат

- [ ] `pnpm build` — 0 ошибок
- [ ] Admin видит каталог товаров на `/app/catalog`
- [ ] Добавить товар: форма с полями по типу (unit/round/bulk)
- [ ] Редактировать/удалить товар
- [ ] Удаление товара → ячейки получают needs_review флаг
- [ ] Управление материалами: добавить кастомный, удалить кастомный
- [ ] Агрегаты по товарам: таблица на `/app/admin/aggregates`
- [ ] Экспорт Excel: скачивается .xlsx файл с агрегатами
- [ ] Журнал действий: список событий с фильтрами
- [ ] Заглушки `/app/catalog` и `/app/settings/audit` убраны

---

## Инвентарь для I-08

Создать `docs/sessions/prompts/I-08-polish-deploy.md`.

**Что включить:**

1. **Полный список файлов `src/`** — результат `find src -type f | sort`
2. **Список всех маршрутов** из router.tsx
3. **Что НЕ прибрано**: анимации (везде ли применены?), офлайн-индикатор (полный?), PWA config
4. **Supabase project ref** и URL — нужны для env переменных Vercel
5. **Команда деплоя** которая использовалась вручную (если была)
6. **Что сломано или не работает** — любые известные баги до polish
