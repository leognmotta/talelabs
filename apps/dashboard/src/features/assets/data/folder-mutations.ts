/** Folder mutations and their folder/Asset cache reconciliation. */

import { deleteFoldersId, patchFoldersId, postFolders } from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { projectQueryKeys } from '../../projects/project-query-keys'
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
  findFolderInCacheSnapshot,
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
        projectId?: null | string
        signal?: AbortSignal
      }) => postFolders(
        {
          data: {
            name: data.name,
            parentId: data.parentId,
            projectId: data.projectId,
          },
        },
        {
          headers: getOrganizationRequestHeaders(data.organizationId),
          signal,
        },
      ),
      onMutate: async ({ organizationId, parentId }) => {
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folderScope(organizationId),
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
        void Promise.all([
          invalidateFolderCache(queryClient, organizationId),
          queryClient.invalidateQueries({
            queryKey: projectQueryKeys.scope(organizationId),
          }),
        ])
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
          queryKey: assetQueryKeys.folderScope(organizationId),
        })
        const folders = snapshotFolderCache(queryClient, organizationId)
        const assets = await snapshotAssetCache(queryClient, organizationId)
        const removedFolder = findFolderInCacheSnapshot(folders, id)
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
            context.folders,
          )
          restoreAssetCache(queryClient, context.assets)
        }
      },
      onSettled: (_data, _error, { organizationId }) => {
        void Promise.all([
          invalidateFolderCache(queryClient, organizationId),
          invalidateAssetCache(queryClient, organizationId),
          queryClient.invalidateQueries({
            queryKey: projectQueryKeys.scope(organizationId),
          }),
        ])
      },
    }),
    update: useMutation({
      mutationFn: ({
        id,
        name,
        organizationId,
        parentId,
        projectId,
      }: {
        id: string
        name?: string
        organizationId: string
        parentId?: null | string
        projectId?: null | string
      }) => patchFoldersId(
        { id, data: { name, parentId, projectId } },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onMutate: async ({
        id,
        name,
        organizationId,
        parentId,
        projectId,
      }) => {
        const patch = {
          ...(name !== undefined ? { name } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
          ...(projectId !== undefined ? { projectId } : {}),
        }
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folderScope(organizationId),
        })
        const snapshot = snapshotFolderCache(queryClient, organizationId)
        const currentFolder = findFolderInCacheSnapshot(snapshot, id)
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
        void Promise.all([
          invalidateFolderCache(queryClient, organizationId),
          queryClient.invalidateQueries({
            queryKey: projectQueryKeys.scope(organizationId),
          }),
        ])
      },
    }),
  }
}
