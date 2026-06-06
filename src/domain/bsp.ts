export type SplitDirection = 'H' | 'V'

export interface BspNode {
  id: string
  parent_id: string | null
  split_direction: SplitDirection | null
  is_first_child: boolean | null
  width_mm?: number | null
  height_mm?: number | null
  computed_width_mm: number
  computed_height_mm: number
}

export function computeChildDimensions(
  parent: BspNode,
  direction: SplitDirection,
  isFirstChild: boolean,
  firstChildOverrideSize?: number | null,
): { computed_width_mm: number; computed_height_mm: number } {
  if (direction === 'V') {
    if (firstChildOverrideSize != null && firstChildOverrideSize > 0) {
      return {
        computed_width_mm: isFirstChild ? firstChildOverrideSize : Math.max(0, parent.computed_width_mm - firstChildOverrideSize),
        computed_height_mm: parent.computed_height_mm,
      }
    }
    return {
      computed_width_mm: Math.floor(parent.computed_width_mm / 2),
      computed_height_mm: parent.computed_height_mm,
    }
  }
  if (firstChildOverrideSize != null && firstChildOverrideSize > 0) {
    return {
      computed_width_mm: parent.computed_width_mm,
      computed_height_mm: isFirstChild ? firstChildOverrideSize : Math.max(0, parent.computed_height_mm - firstChildOverrideSize),
    }
  }
  return {
    computed_width_mm: parent.computed_width_mm,
    computed_height_mm: Math.floor(parent.computed_height_mm / 2),
  }
}

export function recomputeDescendants(nodes: BspNode[]): BspNode[] {
  const byId = new Map(nodes.map(n => [n.id, { ...n }]))
  // Find root of this (sub)tree: the node whose parent is not in this set
  const root = nodes.find(n => !nodes.some(x => x.id === n.parent_id))!

  const queue: string[] = [root.id]
  while (queue.length > 0) {
    const parentId = queue.shift()!
    const parent = byId.get(parentId)!
    if (!parent.split_direction) continue
    const children = nodes.filter(n => n.parent_id === parentId)
    const firstChild = children.find(c => c.is_first_child)
    const overrideSize = parent.split_direction === 'V'
      ? (firstChild?.width_mm ?? null)
      : (firstChild?.height_mm ?? null)

    for (const child of children) {
      const dims = computeChildDimensions(parent, parent.split_direction, child.is_first_child!, overrideSize)
      const updated = byId.get(child.id)!
      updated.computed_width_mm = dims.computed_width_mm
      updated.computed_height_mm = dims.computed_height_mm
      queue.push(child.id)
    }
  }

  return Array.from(byId.values())
}

export function isLeaf(nodeId: string, allNodes: BspNode[]): boolean {
  return !allNodes.some(n => n.parent_id === nodeId)
}

export function getLeafNodes(nodes: BspNode[]): BspNode[] {
  return nodes.filter(n => isLeaf(n.id, nodes))
}
