/** Folder-tree traversal and subtree removal for optimistic deletion. */

import type { Folder, FolderListResponse } from '@talelabs/sdk'
import type { QueryClient } from '@tanstack/react-query'

import { assetQueryKeys } from './asset-query-keys'
import { snapshotFolderCache } from './folder-cache-snapshot'

/** Returns the root folder id and every descendant id, tolerating malformed cycles. */
export function getFolderTreeIds(folders: Folder[], rootId: string) {
  const childrenByParent = new Map<string, string[]>()
  for (const folder of folders) {
    if (!folder.parentId)
      continue
    const children = childrenByParent.get(folder.parentId) ?? []
    children.push(folder.id)
    childrenByParent.set(folder.parentId, children)
  }

  const ids = new Set([rootId])
  const pending = [rootId]
  while (pending.length > 0) {
    const parentId = pending.pop()!
    for (const childId of childrenByParent.get(parentId) ?? []) {
      if (!ids.has(childId)) {
        ids.add(childId)
        pending.push(childId)
      }
    }
  }

  return ids
}

/** Removes one folder subtree from cache and returns all removed ids. */
export function removeFolderTreeCache(
  queryClient: QueryClient,
  organizationId: string,
  rootId: string,
) {
  const current = snapshotFolderCache(queryClient, organizationId)
  if (!current)
    return new Set([rootId])

  const ids = getFolderTreeIds(current.data, rootId)
  queryClient.setQueryData<FolderListResponse>(
    assetQueryKeys.folders(organizationId),
    {
      data: current.data.filter(folder => !ids.has(folder.id)),
    },
  )
  return ids
}
