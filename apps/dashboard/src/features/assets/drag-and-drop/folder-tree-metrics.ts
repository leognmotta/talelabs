/** Cycle-safe folder depth and ancestry calculations used by move admission. */

import type { Folder } from '@talelabs/sdk'

/** Returns a folder's one-based depth, stopping if malformed ancestry cycles. */
export function getFolderDepth(
  folderId: string,
  foldersById: Map<string, Folder>,
) {
  let depth = 0
  let current = foldersById.get(folderId)
  const seen = new Set<string>()

  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    depth += 1
    current = current.parentId ? foldersById.get(current.parentId) : undefined
  }

  return depth
}

/** Returns the maximum depth of the subtree rooted at one folder. */
export function getFolderSubtreeDepth(folderId: string, folders: Folder[]) {
  const children = new Map<null | string, Folder[]>()

  for (const folder of folders) {
    const siblings = children.get(folder.parentId) ?? []
    siblings.push(folder)
    children.set(folder.parentId, siblings)
  }

  let maximum = 1
  const pending = [{ depth: 1, id: folderId }]

  while (pending.length > 0) {
    const current = pending.pop()!
    maximum = Math.max(maximum, current.depth)

    for (const child of children.get(current.id) ?? [])
      pending.push({ depth: current.depth + 1, id: child.id })
  }

  return maximum
}

/** Reports whether the destination is inside the source folder's subtree. */
export function isFolderDescendant(
  sourceFolderId: string,
  destinationFolderId: string,
  foldersById: Map<string, Folder>,
) {
  let current = foldersById.get(destinationFolderId)
  const seen = new Set<string>()

  while (current && !seen.has(current.id)) {
    if (current.id === sourceFolderId)
      return true
    seen.add(current.id)
    current = current.parentId ? foldersById.get(current.parentId) : undefined
  }

  return false
}
