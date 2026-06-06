import type { Cell, Material, Product } from '@/data/db'
import { isLeaf } from '@/domain/bsp'
import { CellCard } from './CellCard'

interface ShelfLevelViewProps {
  parentCell: Cell
  allCells: Cell[]
  products: Product[]
  materials: Material[]
  mode: 'edit' | 'view'
  addressPrefix: string
  sessionId?: string
  visitedCellIds?: Set<string>
  onLeafTap: (cell: Cell) => void
  onSplitTap: (cell: Cell) => void
  onFlagTap: (cell: Cell) => void
}

function getChildAddress(parent: Cell, child: Cell, parentAddress: string): string {
  if (parent.split_direction === 'V') {
    const col = child.is_first_child ? 1 : 2
    return `${parentAddress}(1,${col})`
  }
  if (parent.split_direction === 'H') {
    const row = child.is_first_child ? 1 : 2
    return `${parentAddress}(${row},1)`
  }
  return parentAddress
}

interface LevelGridProps {
  parentCell: Cell
  children: Cell[]
  allCells: Cell[]
  products: Product[]
  materials: Material[]
  mode: 'edit' | 'view'
  addressPrefix: string
  depth: number
  sessionId?: string
  visitedCellIds?: Set<string>
  onLeafTap: (cell: Cell) => void
  onSplitTap: (cell: Cell) => void
  onFlagTap: (cell: Cell) => void
}

function LevelGrid({
  parentCell,
  children,
  allCells,
  products,
  materials,
  mode,
  addressPrefix,
  depth,
  sessionId,
  visitedCellIds,
  onLeafTap,
  onSplitTap,
  onFlagTap,
}: LevelGridProps) {
  const isVSplit = parentCell.split_direction === 'V'
  const sorted = [...children].sort((a, b) => {
    if (a.is_first_child && !b.is_first_child) return -1
    if (!a.is_first_child && b.is_first_child) return 1
    return 0
  })

  const gridStyle: React.CSSProperties = isVSplit
    ? { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', height: '100%' }
    : { display: 'grid', gridTemplateRows: 'repeat(2, 1fr)', gap: '4px', height: '100%' }

  return (
    <div style={gridStyle}>
      {sorted.map(child => {
        const childAddress = getChildAddress(parentCell, child, addressPrefix)
        const displayAddress = childAddress.slice(addressPrefix.length)
        const grandChildren = allCells.filter(c => c.parent_id === child.id)
        const childIsLeaf = isLeaf(child.id, allCells)

        if (!childIsLeaf && grandChildren.length > 0) {
          return (
            <div key={child.id} style={{ position: 'relative' }}>
              <LevelGrid
                parentCell={child}
                children={grandChildren}
                allCells={allCells}
                products={products}
                materials={materials}
                mode={mode}
                addressPrefix={childAddress}
                depth={depth + 1}
                sessionId={sessionId}
                visitedCellIds={visitedCellIds}
                onLeafTap={onLeafTap}
                onSplitTap={onSplitTap}
                onFlagTap={onFlagTap}
              />
            </div>
          )
        }

        return (
          <CellCard
            key={child.id}
            cell={child}
            allCells={allCells}
            products={products}
            materials={materials}
            mode={mode}
            address={displayAddress}
            sessionId={sessionId}
            visitedCellIds={visitedCellIds}
            onTap={cell => {
              if (isLeaf(cell.id, allCells)) {
                onLeafTap(cell)
              } else {
                onSplitTap(cell)
              }
            }}
            onFlagTap={onFlagTap}
          />
        )
      })}
    </div>
  )
}

export function ShelfLevelView({
  parentCell,
  allCells,
  products,
  materials,
  mode,
  addressPrefix,
  sessionId,
  visitedCellIds,
  onLeafTap,
  onSplitTap,
  onFlagTap,
}: ShelfLevelViewProps) {
  const children = allCells
    .filter(c => c.parent_id === parentCell.id)
    .sort((a, b) => {
      if (a.is_first_child && !b.is_first_child) return -1
      if (!a.is_first_child && b.is_first_child) return 1
      return 0
    })

  if (children.length === 0) return null

  return (
    <div className="flex-1 p-4" style={{ minHeight: 0 }}>
      <LevelGrid
        parentCell={parentCell}
        children={children}
        allCells={allCells}
        products={products}
        materials={materials}
        mode={mode}
        addressPrefix={addressPrefix}
        depth={0}
        sessionId={sessionId}
        visitedCellIds={visitedCellIds}
        onLeafTap={onLeafTap}
        onSplitTap={onSplitTap}
        onFlagTap={onFlagTap}
      />
    </div>
  )
}
