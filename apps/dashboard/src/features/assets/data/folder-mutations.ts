/** Folder mutations and their folder/Asset cache reconciliation. */

import { deleteFoldersId, patchFoldersId, postFolders } from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import {
  patchMatchingAssets,
} from './asset-cache-patch'
import {
  invalidateAssetCache,
  restoreAssetCache,
  snapshotAssetCache,
} from './asset-cache-snapshot'
import { assetQueryKeys } from './asset-query-keys'
import {
  invalidateFolderCache,
  restoreFolderCache,
  snapshotFolderCache,
} from './folder-cache-snapshot'
import { removeFolderTreeCache } from './folder-cache-tree'
import {
  adjustFolderItemCountCache,
  patchFolderCache,
  upsertFolderCache,
} from './folder-cache-update'
import { hasOrganizationScopeCache } from './organization-scope-cache'

/**
 * Creates folder mutations with the existing optimistic tree, lineage-count,
 * and affected-Asset rollback behavior.
 */
export function useFolderMutations() {
  const queryClient = useQueryClient()

  return {
    create: useMutation({
      mutationFn: ({
        signal,
        ...data
      }: {
        name: string
        organizationId: string
        parentId?: null | string
        signal?: AbortSignal
      }) => postFolders(
        { data: { name: data.name, parentId: data.parentId } },
        {
          headers: getOrganizationRequestHeaders(data.organizationId),
          signal,
        },
      ),
      onMutate: async ({ organizationId, parentId }) => {
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folders(organizationId),
        })
        const snapshot = snapshotFolderCache(queryClient, organizationId)
        if (parentId)
          adjustFolderItemCountCache(queryClient, organizationId, parentId, 1)
        return { organizationId, snapshot }
      },
      onError: (_error, _variables, context) => {
        if (context && hasOrganizationScopeCache(
          queryClient,
          context.organizationId,
        )) {
          restoreFolderCache(
            queryClient,
            context.organizationId,
            context.snapshot,
          )
        }
      },
      onSuccess: (folder, { organizationId }) => {
        if (!hasOrganizationScopeCache(queryClient, organizationId))
          return
        upsertFolderCache(queryClient, organizationId, folder)
      },
      onSettled: (_data, error, { organizationId }) => {
        void invalidateFolderCache(
          queryClient,
          organizationId,
          error ? 'active' : 'none',
        )
      },
    }),
    remove: useMutation({
      mutationFn: ({ id, organizationId }: {
        id: string
        organizationId: string
      }) => deleteFoldersId(
        { id },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onMutate: async ({ id, organizationId }) => {
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folders(organizationId),
        })
        const folders = snapshotFolderCache(queryClient, organizationId)
        const assets = await snapshotAssetCache(queryClient, organizationId)
        const removedFolder = folders?.data.find(folder => folder.id === id)
        const removedIds = removeFolderTreeCache(queryClient, organizationId, id)
        if (removedFolder?.parentId) {
          adjustFolderItemCountCache(
            queryClient,
            organizationId,
            removedFolder.parentId,
            -1,
          )
        }
        patchMatchingAssets(
          queryClient,
          organizationId,
          asset => asset.folderId !== null && removedIds.has(asset.folderId),
          { folderId: null },
        )
        return { assets, folders, organizationId }
      },
      onError: (_error, _variables, context) => {
        if (context && hasOrganizationScopeCache(
          queryClient,
          context.organizationId,
        )) {
          restoreFolderCache(
            queryClient,
            context.organizationId,
            context.folders,
          )
          restoreAssetCache(queryClient, context.assets)
        }
      },
      onSettled: (_data, _error, { organizationId }) => {
        void Promise.all([
          invalidateFolderCache(queryClient, organizationId),
          invalidateAssetCache(queryClient, organizationId),
        ])
      },
    }),
    update: useMutation({
      mutationFn: ({
        id,
        name,
        organizationId,
        parentId,
      }: {
        id: string
        name?: string
        organizationId: string
        parentId?: null | string
      }) => patchFoldersId(
        { id, data: { name, parentId } },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onMutate: async ({ id, name, organizationId, parentId }) => {
        const patch = {
          ...(name !== undefined ? { name } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
        }
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folders(organizationId),
        })
        const snapshot = snapshotFolderCache(queryClient, organizationId)
        const currentFolder = snapshot?.data.find(folder => folder.id === id)
        if (
          patch.parentId !== undefined
          && patch.parentId !== currentFolder?.parentId
        ) {
          if (currentFolder?.parentId) {
            adjustFolderItemCountCache(
              queryClient,
              organizationId,
              currentFolder.parentId,
              -1,
            )
          }
          if (patch.parentId) {
            adjustFolderItemCountCache(
              queryClient,
              organizationId,
              patch.parentId,
              1,
            )
          }
        }
        patchFolderCache(queryClient, organizationId, id, patch)
        return { organizationId, snapshot }
      },
      onError: (_error, _variables, context) => {
        if (context && hasOrganizationScopeCache(
          queryClient,
          context.organizationId,
        )) {
          restoreFolderCache(
            queryClient,
            context.organizationId,
            context.snapshot,
          )
        }
      },
      onSuccess: (folder, { organizationId }) => {
        if (!hasOrganizationScopeCache(queryClient, organizationId))
          return
        upsertFolderCache(queryClient, organizationId, folder)
      },
      onSettled: (_data, _error, { organizationId }) => {
        void invalidateFolderCache(queryClient, organizationId)
      },
    }),
  }
}
