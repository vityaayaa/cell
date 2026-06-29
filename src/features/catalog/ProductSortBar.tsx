import type { Material, Product } from '@/data/db'

export type SortMode = 'length-desc' | 'length-asc' | 'alpha-asc' | 'alpha-desc'

/** Identical sort logic for catalog / order / checklist.
 * getProduct maps an item to its Product (catalog passes identity). */
export function sortByMode<T>(
  items: T[],
  getProduct: (t: T) => Product | undefined,
  materialMap: Map<string, Material>,
  mode: SortMode,
): T[] {
  return [...items].sort((a, b) => {
    const pa = getProduct(a)
    const pb = getProduct(b)
    if (mode === 'length-desc' || mode === 'length-asc') {
      const la = pa?.length_mm ?? pa?.diameter_mm ?? 0
      const lb = pb?.length_mm ?? pb?.diameter_mm ?? 0
      return mode === 'length-desc' ? lb - la : la - lb
    }
    const ma = pa ? materialMap.get(pa.material_id)?.name ?? '' : ''
    const mb = pb ? materialMap.get(pb.material_id)?.name ?? '' : ''
    const matCmp = ma.localeCompare(mb, 'ru')
    if (matCmp !== 0) return mode === 'alpha-asc' ? matCmp : -matCmp
    const nameCmp = (pa?.name ?? '').localeCompare(pb?.name ?? '', 'ru')
    return mode === 'alpha-asc' ? nameCmp : -nameCmp
  })
}

export type LengthMode = false | 'asc' | 'desc'

/**
 * Sort products WITHIN a group by cross-section: height ascending, then width
 * ascending (e.g. 20×28, 20×40, 30×28, 30×40). Length is IGNORED by default.
 * Only when `lengthMode` is 'asc'/'desc' (the «Длина» toggle is on) does length
 * become the outermost layer, in that direction. For round products diameter
 * stands in for width and there's no height. Missing dims sort as 0.
 */
export function compareByDimensions(
  a: Product,
  b: Product,
  lengthMode: LengthMode = false,
): number {
  if (lengthMode) {
    const la = a.length_mm ?? 0
    const lb = b.length_mm ?? 0
    if (la !== lb) return lengthMode === 'desc' ? lb - la : la - lb
  }
  const ha = a.height_mm ?? 0
  const hb = b.height_mm ?? 0
  if (ha !== hb) return ha - hb
  const wa = a.width_mm ?? a.diameter_mm ?? 0
  const wb = b.width_mm ?? b.diameter_mm ?? 0
  return wa - wb
}

interface ProductSortBarProps {
  materials: Material[]
  /** currently selected material filter, or null for "all" */
  materialId: string | null
  sortMode: SortMode
  onMaterialId: (id: string | null) => void
  onSortMode: (m: SortMode) => void
}

/** The exact 3-button sort bar used in the catalog, reusable everywhere. */
export function ProductSortBar({
  materials,
  materialId,
  sortMode,
  onMaterialId,
  onSortMode,
}: ProductSortBarProps) {
  const selectedMaterial = materialId
    ? materials.find((m) => m.id === materialId) ?? null
    : null

  function cycleMaterial() {
    if (materials.length === 0) return
    const idx = selectedMaterial
      ? materials.findIndex((m) => m.id === selectedMaterial.id)
      : -1
    const next = idx + 1
    onMaterialId(next >= materials.length ? null : materials[next].id)
  }

  return (
    <div className="flex px-4 py-2" style={{ borderBottom: '1px solid var(--border)', gap: 0 }}>
      {/* Material cycle button */}
      <button
        onClick={cycleMaterial}
        className="flex-1 min-w-0 flex items-center justify-center gap-1.5 text-xs font-medium truncate"
        style={{
          height: 36,
          borderRadius: '6px 0 0 6px',
          border: `1px solid ${selectedMaterial ? selectedMaterial.color : 'var(--border)'}`,
          borderRight: 0,
          background: selectedMaterial ? selectedMaterial.color + '33' : 'transparent',
          color: selectedMaterial ? selectedMaterial.color : 'var(--muted-foreground)',
        }}
      >
        {selectedMaterial && (
          <span
            className="rounded-full flex-shrink-0"
            style={{ width: 8, height: 8, background: selectedMaterial.color }}
            aria-hidden
          />
        )}
        <span className="truncate">{selectedMaterial ? selectedMaterial.name : 'Материал'}</span>
      </button>

      {/* Length sort button */}
      <button
        onClick={() =>
          onSortMode(sortMode === 'length-desc' ? 'length-asc' : 'length-desc')
        }
        className="flex-1 min-w-0 flex items-center justify-center gap-1 text-xs font-medium"
        style={{
          height: 36,
          borderRadius: 0,
          border: `1px solid ${sortMode.startsWith('length') ? 'var(--primary)' : 'var(--border)'}`,
          borderRight: 0,
          background: sortMode.startsWith('length') ? 'var(--primary)' : 'transparent',
          color: sortMode.startsWith('length') ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
        }}
      >
        <span>{sortMode === 'length-asc' ? '↑' : '↓'}</span>
        <span className="truncate">Длина</span>
      </button>

      {/* Alpha sort button */}
      <button
        onClick={() =>
          onSortMode(sortMode === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc')
        }
        className="flex-1 min-w-0 flex items-center justify-center text-xs font-medium truncate"
        style={{
          height: 36,
          borderRadius: '0 6px 6px 0',
          border: `1px solid ${sortMode.startsWith('alpha') ? 'var(--primary)' : 'var(--border)'}`,
          background: sortMode.startsWith('alpha') ? 'var(--primary)' : 'transparent',
          color: sortMode.startsWith('alpha') ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
        }}
      >
        {sortMode === 'alpha-desc' ? 'Я-А' : 'А-Я'}
      </button>
    </div>
  )
}
