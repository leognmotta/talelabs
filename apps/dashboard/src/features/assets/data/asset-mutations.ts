/** Asset mutations and their optimistic server-state updates. */

import type { Asset, Tag } from '@talelabs/sdk'

import {
  deleteAssetsId,
  deleteAssetsIdFavorite,
  deleteAssetsIdTagsTagid,
  getAssetsIdDownload,
  patchAssetsId,
  postAssetsIdPurge,
  postAssetsIdRestore,
  postAssetsMove,
  putAssetsIdFavorite,
  putAssetsIdTagsTagid,
} from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { optimisticAssetMutationOptions } from './use-optimistic-asset-mutation'

/**
 * Creates the Asset mutation set used by the library and viewer.
 *
 * Every mutation keeps the existing optimistic cache policy and reconciles with
 * the canonical SDK response through `optimisticAssetMutationOptions`.
 */
export function useAssetMutations() {
  const queryClient = useQueryClient()

  return {
    archive: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        affectsFolderMetadata: true,
        affectsFlowReferences: true,
        mutationFn: ({ id, organizationId }: {
          id: string
          organizationId: string
        }) => deleteAssetsId(
          { id },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getUpdates: ({ id }) => [{ id, patch: { lifecycle: 'archived' } }],
      }),
    ),
    download: useMutation({
      mutationFn: async ({ id, organizationId }: {
        id: string
        organizationId: string
      }) => {
        const result = await getAssetsIdDownload(
          { id },
          { headers: getOrganizationRequestHeaders(organizationId) },
        )
        window.location.assign(result.url)
      },
    }),
    purge: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        affectsElementReferences: true,
        affectsFolderMetadata: true,
        affectsFlowReferences: true,
        mutationFn: ({ id, organizationId }: {
          id: string
          organizationId: string
        }) => postAssetsIdPurge(
          { id },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getServerAssets: asset => [asset],
        getUpdates: ({ id }) => [
          {
            id,
            patch: {
              lifecycle: 'purging',
              thumbnailUrl: null,
              url: null,
            },
          },
        ],
      }),
    ),
    restore: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        affectsFolderMetadata: true,
        affectsFlowReferences: true,
        mutationFn: ({ id, organizationId }: {
          id: string
          organizationId: string
        }) => postAssetsIdRestore(
          { id },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getServerAssets: asset => [asset],
        getUpdates: ({ id }) => [{ id, patch: { lifecycle: 'live' } }],
      }),
    ),
    update: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        affectsFolderMetadata: variables => variables.folderId !== undefined,
        affectsFlowReferences: true,
        mutationFn: ({
          folderId,
          id,
          name,
          organizationId,
        }: {
          folderId?: null | string
          id: string
          name?: string
          organizationId: string
        }) => patchAssetsId(
          { id, data: { folderId, name } },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getServerAssets: asset => [asset],
        getUpdates: ({ folderId, id, name }) => [{
          id,
          patch: {
            ...(folderId !== undefined ? { folderId } : {}),
            ...(name !== undefined ? { name } : {}),
          },
        }],
      }),
    ),
    move: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        affectsFolderMetadata: true,
        getFolderMove: ({ assets, destinationFolderId }) => ({
          assets,
          destinationFolderId,
        }),
        mutationFn: ({
          assets,
          destinationFolderId,
          organizationId,
        }: {
          assets: Asset[]
          destinationFolderId: null | string
          organizationId: string
        }) => postAssetsMove(
          {
            data: {
              assetIds: assets.map(asset => asset.id),
              folderId: destinationFolderId,
            },
          },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getServerAssets: response => response.data,
        getUpdates: ({ assets, destinationFolderId }) =>
          assets.map(asset => ({
            asset,
            id: asset.id,
            patch: { folderId: destinationFolderId },
          })),
      }),
    ),
    favorite: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        mutationFn: ({ favorite, id, organizationId }: {
          favorite: boolean
          id: string
          organizationId: string
        }) =>
          favorite
            ? putAssetsIdFavorite(
                { id },
                { headers: getOrganizationRequestHeaders(organizationId) },
              )
            : deleteAssetsIdFavorite(
                { id },
                { headers: getOrganizationRequestHeaders(organizationId) },
              ),
        getUpdates: ({ favorite, id }) => [{ id, patch: { favorite } }],
      }),
    ),
    addTag: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        mutationFn: ({ assetId, organizationId, tag }: {
          assetId: string
          organizationId: string
          tag: Tag
        }) => putAssetsIdTagsTagid(
          {
            id: assetId,
            tagId: tag.id,
          },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getUpdates: ({ assetId, tag }) => [
          {
            id: assetId,
            patch: asset => ({
              tags: asset.tags.some(item => item.id === tag.id)
                ? asset.tags
                : [...asset.tags, tag],
            }),
          },
        ],
      }),
    ),
    removeTag: useMutation(
      optimisticAssetMutationOptions(queryClient, {
        mutationFn: ({ assetId, organizationId, tag }: {
          assetId: string
          organizationId: string
          tag: Tag
        }) => deleteAssetsIdTagsTagid(
          {
            id: assetId,
            tagId: tag.id,
          },
          { headers: getOrganizationRequestHeaders(organizationId) },
        ),
        getUpdates: ({ assetId, tag }) => [
          {
            id: assetId,
            patch: asset => ({
              tags: asset.tags.filter(item => item.id !== tag.id),
            }),
          },
        ],
      }),
    ),
  }
}
