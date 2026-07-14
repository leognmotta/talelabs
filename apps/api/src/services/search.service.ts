import { createDownloadUrl, TALELABS_PRIVATE_BUCKET } from '@talelabs/storage'

import { searchWorkspaceRows } from '../data/search.data.js'

export type WorkspaceSearchType = 'asset' | 'folder'

const MAX_RESULTS_PER_TYPE = 10

function createSearchThumbnailUrl(thumbnailKey: null | string) {
  if (!thumbnailKey)
    return Promise.resolve(null)

  return createDownloadUrl({
    bucket: TALELABS_PRIVATE_BUCKET,
    key: thumbnailKey,
    responseContentType: 'image/jpeg',
  })
}

export async function searchWorkspace(input: {
  limit: number
  organizationId: string
  query: string
  types: WorkspaceSearchType[]
}) {
  const types = new Set(input.types)
  const limit = Math.min(Math.max(input.limit, 1), MAX_RESULTS_PER_TYPE)

  try {
    const result = await searchWorkspaceRows({
      includeAssets: types.has('asset'),
      includeFolders: types.has('folder'),
      limit,
      organizationId: input.organizationId,
      query: input.query,
    })
    const assets = await Promise.all(result.assets.map(async asset => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      thumbnailUrl: await createSearchThumbnailUrl(asset.thumbnailKey),
    })))
    return { assets, folders: result.folders }
  }
  catch (error) {
    console.error('Error searching workspace:', error)
    throw error
  }
}
