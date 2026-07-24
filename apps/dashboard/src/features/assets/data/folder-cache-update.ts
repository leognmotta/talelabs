/** Direct folder-cache updates for create, rename, move, and count changes. */

import type { Folder, FolderListResponse } from '@talelabs/sdk'
import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { assetQueryKeys } from './asset-query-keys'

type FolderQueryScope
  = | { scoped: false }
    | { projectId: null | string, scoped: true }

function folderQueryScope(queryKey: QueryKey): FolderQueryScope {
  for (let index = 0; index < queryKey.length - 2; index += 1) {
    if (queryKey[index] === 'folders' && queryKey[index + 1] === 'project') {
      const projectId = queryKey[index + 2]
      if (projectId === null || typeof projectId === 'string')
        return { projectId, scoped: true }
    }
  }
  return { scoped: false }
}

function updateFolderCaches(
  queryClient: QueryClient,
  organizationId: string,
  update: (
    current: FolderListResponse | undefined,
    scope: FolderQueryScope,
  ) => FolderListResponse | undefined,
) {
  const entries = queryClient.getQueriesData<FolderListResponse>({
    queryKey: assetQueryKeys.folderScope(organizationId),
  })
  for (const [queryKey, current] of entries) {
    queryClient.setQueryData(
      queryKey,
      update(current, folderQueryScope(queryKey)),
    )
  }
}

/** Inserts or replaces a folder in the initialized folder-tree cache. */
export function upsertFolderCache(
  queryClient: QueryClient,
  organizationId: string,
  folder: Folder,
) {
  updateFolderCaches(queryClient, organizationId, (current, scope) => {
    const belongs = !scope.scoped || scope.projectId === folder.projectId
    if (!belongs) {
      return current
        ? { data: current.data.filter(item => item.id !== folder.id) }
        : current
    }
    if (!current)
      return { data: [folder] }
    const exists = current.data.some(item => item.id === folder.id)
    return {
      data: exists
        ? current.data.map(item => (item.id === folder.id ? folder : item))
        : [...current.data, folder],
    }
  })
}

/** Applies a partial folder update to the initialized tree cache. */
export function patchFolderCache(
  queryClient: QueryClient,
  organizationId: string,
  folderId: string,
  patch: Partial<Folder>,
) {
  updateFolderCaches(queryClient, organizationId, (current, scope) => {
    if (!current)
      return current
    return {
      data: current.data.flatMap((folder) => {
        if (folder.id !== folderId)
          return [folder]
        const updated = { ...folder, ...patch }
        return !scope.scoped || scope.projectId === updated.projectId
          ? [updated]
          : []
      }),
    }
  })
}

/** Adjusts one folder's direct-item count without allowing a negative value. */
export function adjustFolderItemCountCache(
  queryClient: QueryClient,
  organizationId: string,
  folderId: string,
  delta: number,
) {
  updateFolderCaches(queryClient, organizationId, current =>
    current
      ? {
          data: current.data.map(folder =>
            folder.id === folderId
              ? {
                  ...folder,
                  itemCount: Math.max(0, folder.itemCount + delta),
                }
              : folder,
          ),
        }
      : current)
}
