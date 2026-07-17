/** Optimistic Asset mutation transaction with cache snapshot and rollback ownership. */

import type { Asset, FolderListResponse } from '@talelabs/sdk'
import type { QueryClient, UseMutationOptions } from '@tanstack/react-query'

import { invalidateElementCache } from '../../elements/element-query-cache'
import { flowQueryKeys } from '../../flows/data/query-keys/flow-query-keys'
import {
  patchAssetCache,
} from './asset-cache-patch'
import {
  invalidateAssetCache,
  restoreAssetCache,
  snapshotAssetCache,
} from './asset-cache-snapshot'
import { assetQueryKeys } from './asset-query-keys'
import { applyAssetMoveToFolderCache } from './folder-cache-move'
import {
  invalidateFolderCache,
  restoreFolderCache,
  snapshotFolderCache,
} from './folder-cache-snapshot'
import { hasOrganizationScopeCache } from './organization-scope-cache'

/** One Asset cache patch calculated from mutation variables before the request. */
export interface OptimisticAssetUpdate {
  asset?: Asset
  id: string
  patch: Partial<Asset> | ((asset: Asset) => Partial<Asset>)
}

interface AssetMutationContext {
  assets: Awaited<ReturnType<typeof snapshotAssetCache>>
  folders?: FolderListResponse
  organizationId: string
}

/** Builds optimistic mutation lifecycle handlers with snapshot rollback and targeted invalidation. */
export function optimisticAssetMutationOptions<
  TData,
  TVariables extends { organizationId: string },
>(
  queryClient: QueryClient,
  options: {
    affectsElementReferences?: boolean
    affectsFolderMetadata?: boolean | ((variables: TVariables) => boolean)
    affectsFlowReferences?: boolean
    getFolderMove?: (variables: TVariables) => {
      assets: Asset[]
      destinationFolderId: null | string
    }
    getServerAssets?: (data: TData) => Asset[]
    getUpdates: (variables: TVariables) => OptimisticAssetUpdate[]
    mutationFn: (variables: TVariables) => Promise<TData>
  },
): UseMutationOptions<TData, Error, TVariables, AssetMutationContext> {
  return {
    mutationFn: options.mutationFn,
    onMutate: async (variables) => {
      const { organizationId } = variables
      const updates = options.getUpdates(variables)
      const assets = await snapshotAssetCache(
        queryClient,
        organizationId,
        updates.map(update => update.id),
      )
      const folderMove = options.getFolderMove?.(variables)
      let folders: FolderListResponse | undefined
      if (folderMove) {
        await queryClient.cancelQueries({
          queryKey: assetQueryKeys.folders(organizationId),
        })
        folders = snapshotFolderCache(queryClient, organizationId)
      }

      for (const update of updates) {
        patchAssetCache(
          queryClient,
          organizationId,
          update.id,
          update.patch,
          update.asset,
        )
      }

      if (folderMove) {
        applyAssetMoveToFolderCache(
          queryClient,
          organizationId,
          folderMove.assets,
          folderMove.destinationFolderId,
        )
      }

      return { assets, folders, organizationId }
    },
    onError: (_error, _variables, snapshot) => {
      if (!snapshot || !hasOrganizationScopeCache(
        queryClient,
        snapshot.organizationId,
      )) {
        return
      }
      restoreAssetCache(queryClient, snapshot?.assets)
      if (snapshot?.folders) {
        restoreFolderCache(
          queryClient,
          snapshot.organizationId,
          snapshot.folders,
        )
      }
    },
    onSuccess: (data, { organizationId }) => {
      if (!hasOrganizationScopeCache(queryClient, organizationId))
        return
      for (const asset of options.getServerAssets?.(data) ?? []) {
        patchAssetCache(queryClient, organizationId, asset.id, asset)
      }
    },
    onSettled: (_data, _error, variables) => {
      const { organizationId } = variables
      const affectsFolderMetadata
        = typeof options.affectsFolderMetadata === 'function'
          ? options.affectsFolderMetadata(variables)
          : options.affectsFolderMetadata

      void Promise.all([
        invalidateAssetCache(queryClient, organizationId),
        ...(options.affectsElementReferences
          ? [invalidateElementCache(queryClient, organizationId)]
          : []),
        ...(options.affectsFlowReferences
          ? [queryClient.invalidateQueries({
              queryKey: flowQueryKeys.allReferences(organizationId),
            })]
          : []),
        ...(affectsFolderMetadata
          ? [invalidateFolderCache(queryClient, organizationId)]
          : []),
      ])
    },
  }
}
