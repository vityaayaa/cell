export type SplitDirection = 'H' | 'V'

export interface BspNode {
  id: string
  parent_id: string | null
  split_direction: SplitDirection | null
  is_first_child: boolean | null
  width_mm?: number
  height_mm?: number
  computed_width_mm: number
  computed_height_mm: number
}

export function computeChildDimensions(
  parent: BspNode,
  direction: SplitDirection,
  _isFirstChild: boolean,
): { computed_width_mm: number; computed_height_mm: number } {
  if (direction === 'V') {
    return {
      computed_width_mm: Math.floor(parent.computed_width_mm / 2),
      computed_height_mm: parent.computed_height_mm,
    }
  }
  return {
    computed_width_mm: parent.computed_width_mm,
    computed_height_mm: Math.floor(parent.computed_height_mm / 2),
  }
}

export function recomputeDescendants(nodes: BspNode[]): BspNode[] {
  const byId = new Map(nodes.map(n => [n.id, { ...n }]))
  const root = nodes.find(n => n.parent_id === null)!

  // BFS from root
  const queue: string[] = [root.id]
  while (queue.length > 0) {
    const parentId = queue.shift()!
    const parent = byId.get(parentId)!
    const children = nodes.filter(n => n.parent_id === parentId)

    for (const child of children) {
      const dims = computeChildDimensions(parent, parent.split_direction!, child.is_first_child!)
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
