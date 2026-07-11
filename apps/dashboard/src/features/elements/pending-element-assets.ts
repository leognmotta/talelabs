import type { Asset } from '@talelabs/sdk'

interface PendingElementAssetBase {
  clientId: string
  role: string
  sortOrder: number
}

export interface PendingElementAssetUpload extends PendingElementAssetBase {
  file: File
  kind: 'upload'
  previewUrl: string
}

export interface PendingExistingElementAsset extends PendingElementAssetBase {
  asset: Asset
  kind: 'existing'
}

export type PendingElementAsset
  = | PendingElementAssetUpload
    | PendingExistingElementAsset
