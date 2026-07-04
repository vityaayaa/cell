import { Footprints, ClipboardList, CheckSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SchemaFrame, SchemaCaption } from './docsUi'

const PRIMARY = 'var(--primary)'
const WARNING = '#F59E0B'
const BORDER = 'var(--border)'
const FG = 'var(--foreground)'
const MUTED_FG = 'var(--muted-foreground)'
const CARD = 'var(--card)'

/* ─────────────────────────────────────────────────────────
   a) Process flow: Обход → Заявка → Чеклист
   Horizontal on wide, wraps to vertical on narrow via flex-wrap.
   Drawn with HTML boxes + inline SVG arrows so it reflows cleanly.
   ───────────────────────────────────────────────────────── */

function FlowNode({
  icon: Icon,
  title,
  sub,
}: {
  icon: LucideIcon
  title: string
  sub: string
}) {
  return (
    <div
      className="flex flex-col items-center text-center rounded-xl flex-shrink-0"
      style={{
        width: 96,
        padding: '12px 8px',
        background: CARD,
        border: `1px solid ${BORDER}`,
      }}
    >
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
        }}
      >
        <Icon size={20} strokeWidth={1.5} style={{ color: PRIMARY }} />
      </span>
      <span className="text-xs font-semibold mt-2" style={{ color: FG }}>
        {title}
      </span>
      <span className="text-[10px] mt-0.5" style={{ color: MUTED_FG, lineHeight: 1.3 }}>
        {sub}
      </span>
    </div>
  )
}

function FlowArrow() {
  return (
    <span
      className="docs-flow-arrow flex items-center justify-center flex-shrink-0"
      style={{ color: PRIMARY }}
      aria-hidden
    >
      {/* right arrow (horizontal layout) */}
      <svg className="docs-arrow-h" width="24" height="16" viewBox="0 0 24 16" fill="none">
        <path d="M2 8 H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M15 3 L21 8 L15 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {/* down arrow (vertical layout) */}
      <svg className="docs-arrow-v" width="16" height="24" viewBox="0 0 16 24" fill="none">
        <path d="M8 2 V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M3 15 L8 21 L13 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </span>
  )
}

export function ProcessFlowSchema() {
  return (
    <>
      <style>{`
        .docs-flow { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
        .docs-arrow-v { display: none; }
        @media (max-width: 380px) {
          .docs-flow { flex-direction: column; }
          .docs-arrow-h { display: none; }
          .docs-arrow-v { display: block; }
        }
      `}</style>
      <SchemaFrame>
        <div className="docs-flow">
          <FlowNode icon={Footprints} title="Обход" sub="вносим остатки" />
          <FlowArrow />
          <FlowNode icon={ClipboardList} title="Заявка" sub="считаем нехватку" />
          <FlowArrow />
          <FlowNode icon={CheckSquare} title="Чеклист" sub="собираем на складе" />
        </div>
      </SchemaFrame>
      <SchemaCaption>Три шага работы: обход стеллажа, заявка на склад, сборка по чеклисту.</SchemaCaption>
    </>
  )
}

/* ─────────────────────────────────────────────────────────
   b) Shelf grid + cell address (A1, A2, B1…). 4 cols × 3 rows.
   One cell highlighted as "active".
   ───────────────────────────────────────────────────────── */

export function ShelfGridSchema() {
  const cols = 4
  const rows = 3
  const cellW = 66
  const cellH = 44
  const gap = 8
  const padX = 8
  const padY = 8
  const w = padX * 2 + cols * cellW + (cols - 1) * gap
  const h = padY * 2 + rows * cellH + (rows - 1) * gap
  const letters = ['A', 'B', 'C']
  const activeRow = 1 // B
  const activeCol = 2 // A/B..? column index -> address number

  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * (cellW + gap)
      const y = padY + r * (cellH + gap)
      const addr = `${letters[r]}${c + 1}`
      const active = r === activeRow && c === activeCol
      cells.push(
        <g key={addr}>
          <rect
            x={x}
            y={y}
            width={cellW}
            height={cellH}
            rx={6}
            fill={active ? 'color-mix(in srgb, var(--primary) 14%, var(--card))' : CARD}
            stroke={active ? PRIMARY : BORDER}
            strokeWidth={active ? 2 : 1}
          />
          <text
            x={x + cellW / 2}
            y={y + cellH / 2 + 4}
            textAnchor="middle"
            fontSize="13"
            fontWeight={active ? 700 : 500}
            fill={active ? PRIMARY : MUTED_FG}
          >
            {addr}
          </text>
        </g>,
      )
    }
  }

  return (
    <>
      <SchemaFrame>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width="100%"
          style={{ maxWidth: w, display: 'block', margin: '0 auto' }}
          role="img"
          aria-label="Стеллаж — сетка ячеек с адресами, одна ячейка выделена"
        >
          {cells}
        </svg>
      </SchemaFrame>
      <SchemaCaption>
        Стеллаж — это сетка ячеек. У каждой свой адрес (буква ряда + номер столбца): A1, A2, B1…
        Оранжевым — ячейка, на которой вы сейчас.
      </SchemaCaption>
    </>
  )
}

/* ─────────────────────────────────────────────────────────
   c) Capacity + rotation. A cell with product rectangles stacked
   in rows; beside it one product rotated 90° with a rotate arrow.
   ───────────────────────────────────────────────────────── */

export function CapacitySchema() {
  return (
    <>
      <SchemaFrame>
        <svg
          viewBox="0 0 260 150"
          width="100%"
          style={{ maxWidth: 260, display: 'block', margin: '0 auto' }}
          role="img"
          aria-label="Вместимость ячейки и поворот товара"
        >
          {/* Cell */}
          <rect x="8" y="14" width="120" height="122" rx="8" fill={CARD} stroke={BORDER} strokeWidth="1.5" />
          {/* Products packed in rows (4 wide × 3 rows) */}
          {[0, 1, 2].map((row) =>
            [0, 1, 2, 3].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={16 + col * 27}
                y={22 + row * 37}
                width={22}
                height={31}
                rx={3}
                fill="color-mix(in srgb, var(--primary) 22%, var(--card))"
                stroke={PRIMARY}
                strokeWidth="1"
              />
            )),
          )}
          <text x="68" y="150" textAnchor="middle" fontSize="10" fill={MUTED_FG}>
            по ширине × по высоте
          </text>

          {/* Rotation arrow */}
          <path
            d="M150 44 a22 22 0 1 1 -6 -15"
            fill="none"
            stroke={PRIMARY}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M144 29 l1 -12 l10 6"
            fill="none"
            stroke={PRIMARY}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Upright product */}
          <rect x="140" y="70" width="24" height="40" rx="4" fill="color-mix(in srgb, var(--primary) 18%, var(--card))" stroke={PRIMARY} strokeWidth="1.5" />
          {/* Rotated product (90°) */}
          <rect x="196" y="78" width="40" height="24" rx="4" fill="color-mix(in srgb, #F59E0B 18%, var(--card))" stroke={WARNING} strokeWidth="1.5" />
          <text x="188" y="128" textAnchor="middle" fontSize="10" fill={MUTED_FG}>
            поворот 90°
          </text>
        </svg>
      </SchemaFrame>
      <SchemaCaption>
        Товар укладывается рядами — по ширине и высоте ячейки. Если целый ряд не влезает, но
        помещается повёрнутым на 90° (жёлтый), приложение добавит повёрнутые к вместимости.
      </SchemaCaption>
    </>
  )
}

/* ─────────────────────────────────────────────────────────
   d) Borderline position: a pack partially filled, deficit < 1 pack.
   Yellow accent (#F59E0B).
   ───────────────────────────────────────────────────────── */

export function BorderlineSchema() {
  return (
    <>
      <SchemaFrame>
        <svg
          viewBox="0 0 260 96"
          width="100%"
          style={{ maxWidth: 260, display: 'block', margin: '0 auto' }}
          role="img"
          aria-label="Пограничная позиция — нехватки меньше одной пачки"
        >
          {/* Pack outline */}
          <rect x="20" y="20" width="220" height="40" rx="8" fill={CARD} stroke={WARNING} strokeWidth="1.5" />
          {/* Filled portion (the small shortfall) */}
          <rect x="20" y="20" width="52" height="40" rx="8" fill="color-mix(in srgb, #F59E0B 30%, var(--card))" />
          {/* divider at the fill edge */}
          <line x1="72" y1="20" x2="72" y2="60" stroke={WARNING} strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="46" y="44" textAnchor="middle" fontSize="11" fontWeight="600" fill={WARNING}>
            &lt; 1
          </text>
          <text x="156" y="44" textAnchor="middle" fontSize="11" fill={MUTED_FG}>
            одна пачка
          </text>
          <text x="130" y="86" textAnchor="middle" fontSize="10" fill={MUTED_FG}>
            не хватает меньше, чем на целую пачку
          </text>
        </svg>
      </SchemaFrame>
      <SchemaCaption>
        Пограничная позиция: нехватки меньше одной целой пачки. В заявку сама не попадает —
        добавьте вручную, если всё же нужно.
      </SchemaCaption>
    </>
  )
}
