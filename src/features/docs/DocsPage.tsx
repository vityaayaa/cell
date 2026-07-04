import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import {
  Package,
  ClipboardList,
  CheckSquare,
  WifiOff,
  Footprints,
  ListChecks,
  ArrowDownUp,
  HelpCircle,
  Grid3x3,
  Boxes,
  Ruler,
  History,
  Users,
  BarChart3,
  List as ListIcon,
  ArrowUp,
} from 'lucide-react'
import { useAppStore } from '@/data/store'
import { P, List, Li, Steps, Step, Callout, FaqItem } from './docsUi'
import {
  ProcessFlowSchema,
  ShelfGridSchema,
  CapacitySchema,
  BorderlineSchema,
} from './docsSchemas'
import { SectionsDrawer, type DrawerSection } from './SectionsDrawer'

interface DocsSection {
  id: string
  title: string
  icon: React.ElementType
  /** true → admin-only section */
  admin?: boolean
  render: () => React.ReactNode
}

const EMPLOYEE_SECTIONS: DocsSection[] = [
  {
    id: 'about',
    title: 'Что это за приложение',
    icon: HelpCircle,
    render: () => (
      <>
        <P>
          CELL помогает работать со стеллажом магазина: понять, каких товаров не
          хватает, собрать заявку на склад и отметить, что привезли. Раньше это
          делали с бумажкой и «на глаз» — теперь приложение считает нехватку точно и
          хранит историю. Приложение работает как обычный сайт, но ставится на
          телефон как приложение (иконка на экране).
        </P>
        <ProcessFlowSchema />
      </>
    ),
  },
  {
    id: 'walkthrough',
    title: 'Обход стеллажа (внесение остатков)',
    icon: Footprints,
    render: () => (
      <>
        <P>
          Обход — это когда вы идёте вдоль стеллажа и вносите, сколько товара
          осталось в каждой ячейке.
        </P>
        <ShelfGridSchema />
        <Steps>
          <Step n={1}>Начните обход с главного экрана кнопкой «Начать новый обход».</Step>
          <Step n={2}>
            Приложение ведёт вас по ячейкам по порядку. Текущая ячейка показана
            карточкой: её адрес (например A6), товар и сколько уже внесено.
          </Step>
          <Step n={3}>Для штучного товара (доски, трубы) — впишите число штук.</Step>
          <Step n={4}>
            Для товара навалом (сыпучее, мелочь) — двигайте слайдер: деления это
            пачки/ёмкости.
          </Step>
          <Step n={5}>
            Кнопка «Записать и дальше» сохраняет и переводит к следующей ячейке.
            «Пропустить» — если ячейку не считали.
          </Step>
        </Steps>
        <List>
          <Li>Сверху — прогресс «Обход: N из M»: сколько ячеек уже пройдено.</Li>
          <Li>
            Карта стеллажа («вся карта») показывает все ячейки разом: где вы уже
            были, где ещё нет. По ячейке на карте можно перейти к ней.
          </Li>
        </List>
        <Callout variant="info" title="Один обход — один человек">
          Один обход ведёт один человек — не нужно бояться, что двое собьют друг
          друга.
        </Callout>
      </>
    ),
  },
  {
    id: 'no-capacity',
    title: 'Если у ячейки не задана вместимость',
    icon: Ruler,
    render: () => (
      <Callout variant="warning" title="Вместимость не задана">
        Иногда у ячейки не указана вместимость (сколько товара в неё влезает) —
        тогда приложение не сможет посчитать нехватку и покажет предупреждение
        «Вместимость не задана». Внести остаток всё равно можно, но в заявку эта
        ячейка не попадёт, пока вместимость не задаст администратор. Сообщите об
        этом администратору.
      </Callout>
    ),
  },
  {
    id: 'order',
    title: 'Заявка на склад',
    icon: ClipboardList,
    render: () => (
      <>
        <P>
          После обхода приложение само считает, чего и сколько не хватает, и
          собирает черновик заявки.
        </P>
        <List>
          <Li>Открывается кнопкой «→ К заявке» или через нижнюю навигацию.</Li>
          <Li>
            Каждая позиция — товар и сколько пачек нужно привезти. Нажмите на
            позицию, чтобы изменить количество, или уберите её.
          </Li>
          <Li>
            Кнопка «Добавить товар» — добавить позицию вручную, которой нет в
            автоматическом расчёте.
          </Li>
          <Li>
            Когда заявка готова — «Финализировать заявку». После этого она
            фиксируется и превращается в чеклист.
          </Li>
        </List>
        <BorderlineSchema />
        <Callout variant="tip" title="Пограничные позиции">
          «Пограничные позиции» (жёлтые, со значком ⚠) — это товары, которых не
          хватает меньше, чем на одну целую пачку. Они НЕ попадают в заявку сами:
          чаще всего ради пары штук ехать смысла нет. Но если всё же нужно —
          нажмите на такую позицию и добавьте её в заявку вручную.
        </Callout>
      </>
    ),
  },
  {
    id: 'checklist',
    title: 'Чеклист (сборка на складе)',
    icon: CheckSquare,
    render: () => (
      <>
        <P>
          Чеклист — это финализированная заявка, по которой вы собираете товар на
          складе.
        </P>
        <List>
          <Li>Список позиций со статусами. Отмечайте, что взяли.</Li>
          <Li>
            Если чего-то нет на складе или взяли не всё — можно отметить и это.
          </Li>
          <Li>
            Сортировка и фильтры помогают идти по складу удобным порядком (например
            по длине — длинные позиции отдельно).
          </Li>
          <Li>
            Чеклист можно распечатать (кнопка «Печать») — получится бумажная форма с
            клетками для отметок вручную. Двусторонняя печать и «несколько страниц на
            лист» настраиваются в окне печати вашего принтера, не в приложении.
          </Li>
        </List>
      </>
    ),
  },
  {
    id: 'sorting',
    title: 'Сортировка списков товаров',
    icon: ArrowDownUp,
    render: () => (
      <>
        <P>
          Везде, где есть список товаров (каталог, заявка, выбор товара), работает
          одинаковая сортировка:
        </P>
        <List>
          <Li>«Материал» — показать только товары выбранного материала.</Li>
          <Li>«Длина» (↑/↓) — сортировать по длине.</Li>
          <Li>«А-Я / Я-А» — по алфавиту.</Li>
          <Li>
            По умолчанию товары внутри группы идут так: сначала по названию
            (одинаковые названия держатся вместе — например все «труба красная»,
            потом все «труба серая»), затем по сечению (высота, ширина), затем по
            длине. Кнопка «Длина» поднимает длину выше сечения.
          </Li>
        </List>
      </>
    ),
  },
  {
    id: 'offline',
    title: 'Работа офлайн',
    icon: WifiOff,
    render: () => (
      <>
        <P>
          Приложение рассчитано на постоянный интернет, но если связь пропала — всё
          продолжает работать. Внесённые остатки и правки сохраняются на телефоне и
          сами уходят на сервер, когда связь вернётся. Ничего не теряется. Индикатор
          офлайна показывает, когда нет связи.
        </P>
      </>
    ),
  },
  {
    id: 'faq-employee',
    title: 'Частые вопросы',
    icon: ListChecks,
    render: () => (
      <div className="mt-1">
        <FaqItem q="Почему товара нет в заявке, хотя его мало?" first>
          Возможно, не хватает меньше чем на пачку — тогда он в «пограничных
          позициях». Или у ячейки не задана вместимость.
        </FaqItem>
        <FaqItem q="Что значит пограничная позиция?">
          Нехватка меньше одной пачки. Не добавляется в заявку автоматически;
          добавьте вручную, если нужно.
        </FaqItem>
        <FaqItem q="Я ошибся при внесении остатка — как исправить?">
          Вернитесь к ячейке (стрелками или через карту) и внесите заново;
          сохранится последнее значение.
        </FaqItem>
        <FaqItem q="Внёс остаток без интернета — он сохранился?">
          Да. Уйдёт на сервер, когда появится связь.
        </FaqItem>
        <FaqItem q="Можно ли вести обход вдвоём?">
          Один обход ведёт один человек; так задумано, чтобы данные не путались.
        </FaqItem>
      </div>
    ),
  },
]

const ADMIN_SECTIONS: DocsSection[] = [
  {
    id: 'admin-shelf',
    title: 'Настройка стеллажа',
    icon: Grid3x3,
    admin: true,
    render: () => (
      <P>
        Администратор задаёт стеллаж: сколько столбцов и рядов ячеек. Ячейки можно
        делить (одну на несколько) и объединять обратно — под реальную геометрию
        стеллажа.
      </P>
    ),
  },
  {
    id: 'admin-cells',
    title: 'Ячейки: деление, объединение, настройки',
    icon: Boxes,
    admin: true,
    render: () => (
      <List>
        <Li>
          Ячейку можно разделить на столбцы или ряды (например одну большую — на 3
          полки).
        </Li>
        <Li>
          Разделённые ячейки можно объединить обратно («убрать перегородки»).
        </Li>
        <Li>
          У каждой ячейки — настройки: размеры (ширина, высота, глубина в мм),
          разрешён ли поворот товара, ручная вместимость.
        </Li>
      </List>
    ),
  },
  {
    id: 'admin-catalog',
    title: 'Каталог: товары, группы, материалы',
    icon: Package,
    admin: true,
    render: () => (
      <List>
        <Li>
          Товар: название, тип (штучный / круглый / навалом), размеры, размер пачки,
          группа, материал.
        </Li>
        <Li>
          Группа (вид товара: Брусок, Наличник, Труба) — обязательна для каждого
          товара. Можно задать «название товара» для автоподбора: если название
          группы во множественном числе (Бруски), впишите форму товара (брусок) —
          новые товары сами попадут в группу. Можно указать несколько форм через
          запятую («уголок, угол»).
        </Li>
        <Li>Материал — с цветом, для визуального различения и фильтра.</Li>
        <Li>
          Короткое имя товара (display name) показывается на рабочих экранах; в
          каталоге виден полный набор.
        </Li>
      </List>
    ),
  },
  {
    id: 'admin-capacity',
    title: 'Вместимость и поворот',
    icon: Ruler,
    admin: true,
    render: () => (
      <>
        <P>
          Приложение считает, сколько товара влезает в ячейку: по ширине и высоте
          ячейки относительно сечения товара.
        </P>
        <CapacitySchema />
        <List>
          <Li>
            Если товар не влезает как есть, но влезает повёрнутым на 90° — и поворот
            разрешён у ячейки — приложение добавит повёрнутые в вместимость.
          </Li>
          <Li>
            Ручная вместимость: если ввести число вручную, оно перекрывает расчёт.
            Для товаров навалом вместимость всегда задаётся вручную (в пачках).
          </Li>
          <Li>
            Круглый товар (трубы) — вместимость считается по диаметру автоматически.
          </Li>
        </List>
      </>
    ),
  },
  {
    id: 'admin-audit',
    title: 'История и аудит',
    icon: History,
    admin: true,
    render: () => (
      <P>
        Все важные действия записываются: создание/изменение/удаление товаров,
        групп, сессий обхода. Администратор видит историю — кто и что менял.
      </P>
    ),
  },
  {
    id: 'admin-users',
    title: 'Пользователи',
    icon: Users,
    admin: true,
    render: () => (
      <P>
        Администратор добавляет сотрудников и управляет доступом. Первый
        администратор создаётся при первом запуске.
      </P>
    ),
  },
  {
    id: 'admin-stats',
    title: 'Статистика и экспорт',
    icon: BarChart3,
    admin: true,
    render: () => (
      <P>
        Администратору доступны сводные данные по обходам и заявкам, а также
        экспорт.
      </P>
    ),
  },
  {
    id: 'faq-admin',
    title: 'Частые вопросы (администратор)',
    icon: ListChecks,
    admin: true,
    render: () => (
      <div className="mt-1">
        <FaqItem q="Как задать вместимость, если расчёт неверный?" first>
          В настройках ячейки введите вместимость вручную — она перекроет
          автоматический расчёт.
        </FaqItem>
        <FaqItem q="Товар не попадает в нужную группу автоматически">
          Проверьте поле «название товара» у группы; можно указать несколько форм
          через запятую.
        </FaqItem>
        <FaqItem q="Зачем короткое имя товара?">
          Чтобы на рабочих экранах (обход, заявка, чеклист) названия были
          компактными; в каталоге показывается полное.
        </FaqItem>
        <FaqItem q="Что происходит при удалении товара, назначенного в ячейки?">
          Ячейки освобождаются и помечаются флагом на проверку.
        </FaqItem>
      </div>
    ),
  },
]

const FEATURE_TILES = [
  { icon: Package, label: 'Учёт остатков' },
  { icon: ClipboardList, label: 'Заявки на склад' },
  { icon: CheckSquare, label: 'Чеклист сборки' },
  { icon: WifiOff, label: 'Работает офлайн' },
]

/** Find the scrolling ancestor (AppLayout's <main>), not window. */
function findScrollParent(fromEl: HTMLElement | null): HTMLElement | null {
  let node = fromEl?.parentElement ?? null
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return null
}

export default function DocsPage() {
  const userRole = useAppStore((s) => s.userRole)
  const isAdmin = userRole === 'admin'

  const sections = useMemo(
    () => (isAdmin ? [...EMPLOYEE_SECTIONS, ...ADMIN_SECTIONS] : EMPLOYEE_SECTIONS),
    [isAdmin],
  )

  const drawerSections: DrawerSection[] = useMemo(
    () => sections.map((s) => ({ id: s.id, title: s.title, admin: s.admin })),
    [sections],
  )

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollParentRef = useRef<HTMLElement | null>(null)

  // Scroll-spy: track which section is currently near the top of the
  // scrolling container (AppLayout's <main>, NOT window).
  useEffect(() => {
    const scroller = findScrollParent(rootRef.current)
    scrollParentRef.current = scroller
    if (!scroller) return

    const spy = () => {
      const scRect = scroller.getBoundingClientRect()
      // Anchor line ~120px below the top of the viewport.
      const anchor = scRect.top + 120
      let current: string | null = sections[0]?.id ?? null
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= anchor) current = s.id
        else break
      }
      setActiveId((prev) => (prev === current ? prev : current))
    }

    spy()
    scroller.addEventListener('scroll', spy, { passive: true })
    return () => scroller.removeEventListener('scroll', spy)
  }, [sections])

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      setDrawerOpen(false)
      // Let the drawer close animation begin, then scroll.
      requestAnimationFrame(() => scrollToSection(id))
    },
    [scrollToSection],
  )

  const scrollToTop = useCallback(() => {
    const scroller = scrollParentRef.current ?? findScrollParent(rootRef.current)
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div ref={rootRef} style={{ background: 'var(--background)' }}>
      <div className="px-4 py-5" style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 96 }}>
        {/* Hero */}
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Справка
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
          Как пользоваться приложением: обход стеллажа, заявки на склад и сборка по
          чеклисту.
        </p>

        {/* Feature tiles */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          {FEATURE_TILES.map((t) => {
            const Icon = t.icon
            return (
              <div
                key={t.label}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
              >
                <span
                  className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{
                    width: 34,
                    height: 34,
                    background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                  }}
                >
                  <Icon size={18} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--foreground)', lineHeight: 1.25 }}
                >
                  {t.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-3 mt-5">
          {sections.map((s, i) => {
            const Icon = s.icon
            const showAdminDivider = s.admin && (i === 0 || !sections[i - 1].admin)
            return (
              <div key={s.id}>
                {showAdminDivider && (
                  <div
                    className="flex items-center gap-3 mt-4 mb-1"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span
                      className="text-xs font-semibold uppercase"
                      style={{ letterSpacing: '0.08em' }}
                    >
                      Для администратора
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                )}
                <section
                  id={s.id}
                  className="rounded-2xl p-4"
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    scrollMarginTop: 12,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{
                        width: 32,
                        height: 32,
                        background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                      }}
                    >
                      <Icon size={18} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
                    </span>
                    <h2
                      className="text-base font-bold"
                      style={{ color: 'var(--foreground)', lineHeight: 1.25 }}
                    >
                      {s.title}
                    </h2>
                  </div>
                  <div className="mt-1">{s.render()}</div>
                </section>
              </div>
            )
          })}
        </div>

        {/* Back to top */}
        <button
          onClick={scrollToTop}
          className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-medium mt-4"
          style={{
            minHeight: 44,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--muted-foreground)',
          }}
        >
          <ArrowUp size={16} strokeWidth={1.5} />
          Наверх
        </button>
      </div>

      {/* Floating "Разделы" button — above BottomNav (64px) */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="no-print fixed flex items-center gap-2 rounded-full font-semibold"
        style={{
          right: 16,
          bottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)',
          zIndex: 50,
          height: 48,
          padding: '0 18px',
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.28)',
        }}
        aria-label="Открыть список разделов"
      >
        <ListIcon size={18} strokeWidth={2} />
        <span className="text-sm">Разделы</span>
      </button>

      <SectionsDrawer
        open={drawerOpen}
        sections={drawerSections}
        activeId={activeId}
        onClose={() => setDrawerOpen(false)}
        onSelect={handleSelect}
      />
    </div>
  )
}
