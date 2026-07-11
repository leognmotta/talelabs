import type { Asset, FolderListResponse } from '@talelabs/sdk'
import type { QueryClient, UseMutationOptions } from '@tanstack/react-query'

import {
  invalidateAssetCache,
  patchAssetCache,
  restoreAssetCache,
  snapshotAssetCache,
} from './asset-query-cache'
import { assetQueryKeys } from './asset-query-keys'
import {
  applyAssetMoveToFolderCache,
  invalidateFolderCache,
  restoreFolderCache,
  snapshotFolderCache,
} from './folder-query-cache'

export interface OptimisticAssetUpdate {
  asset?: Asset
  id: string
  patch: Partial<Asset> | ((asset: Asset) => Partial<Asset>)
}

interface AssetMutationContext {
  assets: Awaited<ReturnType<typeof snapshotAssetCache>>
  folders?: FolderListResponse
}

export function optimisticAssetMutationOptions<TData, TVariables>(
  queryClient: QueryClient,
  organizationId: null | string,
  options: {
    affectsFolderMetadata?: boolean | ((variables: TVariables) => boolean)
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
      if (!organizationId)
        throw new Error('An active organization is required.')

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

      return { assets, folders }
    },
    onError: (_error, _variables, snapshot) => {
      restoreAssetCache(queryClient, snapshot?.assets)
      if (organizationId && snapshot?.folders)
        restoreFolderCache(queryClient, organizationId, snapshot.folders)
    },
    onSuccess: (data) => {
      for (const asset of options.getServerAssets?.(data) ?? []) {
        if (organizationId)
          patchAssetCache(queryClient, organizationId, asset.id, asset)
      }
    },
    onSettled: (_data, _error, variables) => {
      const affectsFolderMetadata
        = typeof options.affectsFolderMetadata === 'function'
          ? options.affectsFolderMetadata(variables)
          : options.affectsFolderMetadata

      void Promise.all([
        ...(organizationId
          ? [invalidateAssetCache(queryClient, organizationId)]
          : []),
        ...(organizationId && affectsFolderMetadata
          ? [invalidateFolderCache(queryClient, organizationId)]
          : []),
      ])
    },
  }
}
