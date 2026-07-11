import type { Folder } from '@talelabs/sdk'
import type { LibraryDragData } from './asset-drag-data'

const MAX_FOLDER_DEPTH = 32

export type MoveRejection = 'depth' | 'descendant' | 'same-folder' | 'self'

export type MoveValidation
  = | { allowed: true }
    | { allowed: false, reason: MoveRejection }

function getFolderDepth(folderId: string, foldersById: Map<string, Folder>) {
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

function getSubtreeDepth(folderId: string, folders: Folder[]) {
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

function isDescendant(sourceFolderId: string, destinationFolderId: string, foldersById: Map<string, Folder>) {
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

export function validateFolderMove(
  source: { folderId: string, parentId: null | string },
  destinationFolderId: null | string,
  folders: Folder[],
): MoveValidation {
  if (destinationFolderId === source.folderId)
    return { allowed: false, reason: 'self' }

  if (destinationFolderId === source.parentId)
    return { allowed: false, reason: 'same-folder' }

  if (destinationFolderId === null)
    return { allowed: true }

  const foldersById = new Map(folders.map(folder => [folder.id, folder]))

  if (isDescendant(source.folderId, destinationFolderId, foldersById))
    return { allowed: false, reason: 'descendant' }

  const destinationDepth = getFolderDepth(destinationFolderId, foldersById)
  const subtreeDepth = getSubtreeDepth(source.folderId, folders)

  if (destinationDepth + subtreeDepth > MAX_FOLDER_DEPTH)
    return { allowed: false, reason: 'depth' }

  return { allowed: true }
}

export function validateLibraryMove(
  source: LibraryDragData,
  destinationFolderId: null | string,
  folders: Folder[],
): MoveValidation {
  if (source.type === 'asset') {
    return source.sourceFolderId === destinationFolderId
      ? { allowed: false, reason: 'same-folder' }
      : { allowed: true }
  }

  return validateFolderMove(source, destinationFolderId, folders)
}
