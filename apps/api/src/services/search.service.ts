import { createDownloadUrl, TALELABS_PRIVATE_BUCKET } from '@talelabs/storage'

import { listElementPreviewAssets } from '../data/elements.data.js'
import { searchWorkspaceRows } from '../data/search.data.js'
import { ELEMENT_PREVIEW_ROLES } from '../domain/elements/element-preview-roles.js'
import { createAssetThumbnailUrl } from './asset-presenter.js'

export type WorkspaceSearchType = 'asset' | 'element' | 'folder'

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
      includeElements: types.has('element'),
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
    const previewRows = await listElementPreviewAssets({
      elementIds: result.elements.map(element => element.id),
      organizationId: input.organizationId,
      previewRoles: ELEMENT_PREVIEW_ROLES,
    })
    const previews = new Map(previewRows.map(asset => [asset.elementId, asset]))
    const elements = await Promise.all(result.elements.map(async (element) => {
      const preview = previews.get(element.id)
      return {
        ...element,
        thumbnailUrl: preview
          ? await createAssetThumbnailUrl(preview)
          : null,
      }
    }))

    return { assets, elements, folders: result.folders }
  }
  catch (error) {
    console.error('Error searching workspace:', error)
    throw error
  }
}
