import { useMemo } from 'react'
import { useAppStore } from '@/data/store'

interface DocsSection {
  id: string
  title: string
  /** true → admin-only section */
  admin?: boolean
  render: () => React.ReactNode
}

/** Shared list styling — bullet lists inside a section */
function List({ children }: { children: React.ReactNode }) {
  return (
    <ul
      className="flex flex-col gap-2 mt-2"
      style={{ paddingLeft: 18, listStyle: 'disc', color: 'var(--muted-foreground)' }}
    >
      {children}
    </ul>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
      {children}
    </p>
  )
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-sm" style={{ lineHeight: 1.55 }}>
      {children}
    </li>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-sm font-semibold mt-4"
      style={{ color: 'var(--foreground)' }}
    >
      {children}
    </h3>
  )
}

const EMPLOYEE_SECTIONS: DocsSection[] = [
  {
    id: 'about',
    title: 'Что это за приложение',
    render: () => (
      <P>
        CELL помогает работать со стеллажом магазина: понять, каких товаров не
        хватает, собрать заявку на склад и отметить, что привезли. Раньше это
        делали с бумажкой и «на глаз» — теперь приложение считает нехватку точно и
        хранит историю. Приложение работает как обычный сайт, но ставится на
        телефон как приложение (иконка на экране).
      </P>
    ),
  },
  {
    id: 'walkthrough',
    title: 'Обход стеллажа (внесение остатков)',
    render: () => (
      <>
        <P>
          Обход — это когда вы идёте вдоль стеллажа и вносите, сколько товара
          осталось в каждой ячейке.
        </P>
        <List>
          <Li>Начните обход с главного экрана кнопкой «Начать новый обход».</Li>
          <Li>
            Приложение ведёт вас по ячейкам по порядку. Текущая ячейка показана
            карточкой: её адрес (например A6), товар и сколько уже внесено.
          </Li>
          <Li>Для штучного товара (доски, трубы) — впишите число штук.</Li>
          <Li>
            Для товара навалом (сыпучее, мелочь) — двигайте слайдер: деления это
            пачки/ёмкости.
          </Li>
          <Li>
            Кнопка «Записать и дальше» сохраняет и переводит к следующей ячейке.
            «Пропустить» — если ячейку не считали.
          </Li>
          <Li>Сверху — прогресс «Обход: N из M»: сколько ячеек уже пройдено.</Li>
          <Li>
            Карта стеллажа («вся карта») показывает все ячейки разом: где вы уже
            были, где ещё нет. По ячейке на карте можно перейти к ней.
          </Li>
          <Li>
            Один обход ведёт один человек — не нужно бояться, что двое собьют друг
            друга.
          </Li>
        </List>
      </>
    ),
  },
  {
    id: 'no-capacity',
    title: 'Если у ячейки не задана вместимость',
    render: () => (
      <P>
        Иногда у ячейки не указана вместимость (сколько товара в неё влезает) —
        тогда приложение не сможет посчитать нехватку и покажет предупреждение
        «Вместимость не задана». Внести остаток всё равно можно, но в заявку эта
        ячейка не попадёт, пока вместимость не задаст администратор. Сообщите об
        этом администратору.
      </P>
    ),
  },
  {
    id: 'order',
    title: 'Заявка на склад',
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
            «Пограничные позиции» (жёлтые, со значком ⚠) — это товары, которых не
            хватает меньше, чем на одну целую пачку. Они НЕ попадают в заявку сами:
            чаще всего ради пары штук ехать смысла нет. Но если всё же нужно —
            нажмите на такую позицию и добавьте её в заявку вручную.
          </Li>
          <Li>
            Когда заявка готова — «Финализировать заявку». После этого она
            фиксируется и превращается в чеклист.
          </Li>
        </List>
      </>
    ),
  },
  {
    id: 'checklist',
    title: 'Чеклист (сборка на складе)',
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
    render: () => (
      <P>
        Приложение рассчитано на постоянный интернет, но если связь пропала — всё
        продолжает работать. Внесённые остатки и правки сохраняются на телефоне и
        сами уходят на сервер, когда связь вернётся. Ничего не теряется. Индикатор
        офлайна показывает, когда нет связи.
      </P>
    ),
  },
  {
    id: 'faq-employee',
    title: 'Частые вопросы',
    render: () => (
      <>
        <H3>Почему товара нет в заявке, хотя его мало?</H3>
        <P>
          Возможно, не хватает меньше чем на пачку — тогда он в «пограничных
          позициях». Или у ячейки не задана вместимость.
        </P>
        <H3>Что значит пограничная позиция?</H3>
        <P>
          Нехватка меньше одной пачки. Не добавляется в заявку автоматически;
          добавьте вручную, если нужно.
        </P>
        <H3>Я ошибся при внесении остатка — как исправить?</H3>
        <P>
          Вернитесь к ячейке (стрелками или через карту) и внесите заново;
          сохранится последнее значение.
        </P>
        <H3>Внёс остаток без интернета — он сохранился?</H3>
        <P>Да. Уйдёт на сервер, когда появится связь.</P>
        <H3>Можно ли вести обход вдвоём?</H3>
        <P>
          Один обход ведёт один человек; так задумано, чтобы данные не путались.
        </P>
      </>
    ),
  },
]

const ADMIN_SECTIONS: DocsSection[] = [
  {
    id: 'admin-shelf',
    title: 'Настройка стеллажа',
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
    admin: true,
    render: () => (
      <>
        <P>
          Приложение считает, сколько товара влезает в ячейку: по ширине и высоте
          ячейки относительно сечения товара.
        </P>
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
    admin: true,
    render: () => (
      <>
        <H3>Как задать вместимость, если расчёт неверный?</H3>
        <P>
          В настройках ячейки введите вместимость вручную — она перекроет
          автоматический расчёт.
        </P>
        <H3>Товар не попадает в нужную группу автоматически</H3>
        <P>
          Проверьте поле «название товара» у группы; можно указать несколько форм
          через запятую.
        </P>
        <H3>Зачем короткое имя товара?</H3>
        <P>
          Чтобы на рабочих экранах (обход, заявка, чеклист) названия были
          компактными; в каталоге показывается полное.
        </P>
        <H3>Что происходит при удалении товара, назначенного в ячейки?</H3>
        <P>Ячейки освобождаются и помечаются флагом на проверку.</P>
      </>
    ),
  },
]

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** The app content scrolls inside AppLayout's <main>, not window. */
function scrollToTop(fromEl: HTMLElement | null) {
  let node = fromEl?.parentElement ?? null
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      node.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    node = node.parentElement
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

export default function DocsPage() {
  const userRole = useAppStore((s) => s.userRole)
  const isAdmin = userRole === 'admin'

  const sections = useMemo(
    () => (isAdmin ? [...EMPLOYEE_SECTIONS, ...ADMIN_SECTIONS] : EMPLOYEE_SECTIONS),
    [isAdmin],
  )

  return (
    <div style={{ background: 'var(--background)' }}>
      <div className="px-4 py-5" style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Page title */}
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
          Справка
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Как пользоваться приложением. Вернуться — через нижнюю навигацию.
        </p>

        {/* Table of contents */}
        <nav
          className="mt-4 rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
          aria-label="Оглавление"
        >
          <p
            className="text-xs font-semibold uppercase px-4 pt-3 pb-1"
            style={{ color: 'var(--muted-foreground)', letterSpacing: '0.05em' }}
          >
            Содержание
          </p>
          <ul>
            {sections.map((s, i) => (
              <li key={s.id}>
                {s.admin && (i === 0 || !sections[i - 1].admin) && (
                  <p
                    className="text-xs font-semibold uppercase px-4 pt-3 pb-1 mt-1"
                    style={{
                      color: 'var(--muted-foreground)',
                      letterSpacing: '0.05em',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    Для администратора
                  </p>
                )}
                <button
                  onClick={() => scrollToSection(s.id)}
                  className="w-full text-left text-sm px-4"
                  style={{
                    minHeight: 44,
                    color: 'var(--foreground)',
                    borderTop:
                      i > 0 && !(s.admin && !sections[i - 1].admin)
                        ? '1px solid var(--border)'
                        : 'none',
                  }}
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sections */}
        <div className="flex flex-col gap-3 mt-4">
          {sections.map((s, i) => (
            <div key={s.id}>
              {/* Admin block divider */}
              {s.admin && (i === 0 || !sections[i - 1].admin) && (
                <div
                  className="flex items-center gap-3 mt-3 mb-1"
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
                className="rounded-xl p-4"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  scrollMarginTop: 16,
                }}
              >
                <h2
                  className="text-base font-bold"
                  style={{ color: 'var(--foreground)' }}
                >
                  {s.title}
                </h2>
                {s.render()}
              </section>
            </div>
          ))}
        </div>

        {/* Back to top */}
        <button
          onClick={(e) => scrollToTop(e.currentTarget)}
          className="w-full rounded-xl text-sm font-medium mt-4"
          style={{
            minHeight: 44,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--muted-foreground)',
          }}
        >
          Наверх ↑
        </button>
      </div>
    </div>
  )
}
