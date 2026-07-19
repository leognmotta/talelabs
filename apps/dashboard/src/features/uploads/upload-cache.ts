/** Query-cache side effects invoked only after upload persistence commits. */

import type { Asset, Folder } from '@talelabs/sdk'
import type { QueryClient } from '@tanstack/react-query'

import { createAssetRegisteredCacheHandler } from './upload-asset-cache'
import { createUploadFolderCacheHandler } from './upload-folder-cache'

/** Cache operations required by folder preparation and canonical Asset registration. */
export interface UploadCacheAdapter {
  /** Upserts the registered Asset and refreshes affected Asset/folder collections. */
  assetRegistered: (organizationId: string, asset: Asset) => Promise<void>
  /** Creates one folder and publishes it into the organization folder cache. */
  createFolder: (
    organizationId: string,
    input: { name: string, parentId: null | string },
    signal: AbortSignal,
  ) => Promise<Folder>
}

/** Binds upload commit events to the mounted dashboard QueryClient. */
export function createUploadCacheAdapter(
  queryClient: QueryClient,
): UploadCacheAdapter {
  return {
    assetRegistered: createAssetRegisteredCacheHandler(queryClient),
    createFolder: createUploadFolderCacheHandler(queryClient),
  }
}
