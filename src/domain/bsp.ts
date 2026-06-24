export type SplitDirection = 'H' | 'V'

export interface BspNode {
  id: string
  parent_id: string | null
  split_direction: SplitDirection | null
  child_index: number | null
  computed_width_mm: number
  computed_height_mm: number
}

/**
 * Recompute computed_width_mm / computed_height_mm for an entire subtree, given
 * the root's computed_* as its real size. Each split divides the parent's size
 * EQUALLY among its children along the split axis (floored); the other axis is
 * inherited unchanged. If the root has size 0, the whole subtree stays 0.
 *
 * `nodes` must contain the root (the node whose parent is not in the set) and
 * all of its descendants. Children are addressed via parent_id.
 */
export function recomputeDescendants(nodes: BspNode[]): BspNode[] {
  const byId = new Map(nodes.map(n => [n.id, { ...n }]))
  const root = nodes.find(n => !nodes.some(x => x.id === n.parent_id))!

  const queue: string[] = [root.id]
  while (queue.length > 0) {
    const parentId = queue.shift()!
    const parent = byId.get(parentId)!
    if (!parent.split_direction) continue
    const children = nodes.filter(n => n.parent_id === parentId)
    const count = children.length
    if (count === 0) continue

    for (const child of children) {
      const updated = byId.get(child.id)!
      if (parent.split_direction === 'V') {
        updated.computed_width_mm = Math.floor(parent.computed_width_mm / count)
        updated.computed_height_mm = parent.computed_height_mm
      } else {
        updated.computed_width_mm = parent.computed_width_mm
        updated.computed_height_mm = Math.floor(parent.computed_height_mm / count)
      }
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
