import type { NormalizedGenerationMediaAsset } from '@talelabs/flows'

export interface OrderedVideoMediaInput {
  asset: NormalizedGenerationMediaAsset
  targetSlotId: string
}

export interface OpenRouterFrameImage {
  frame_type: 'first_frame' | 'last_frame'
  image_url: { url: string }
  type: 'image_url'
}

export type OpenRouterVideoReference
  = | { audio_url: { url: string }, type: 'audio_url' }
    | { image_url: { url: string }, type: 'image_url' }
    | { type: 'video_url', video_url: { url: string } }

export interface OpenRouterVideoInputs {
  frameImages: OpenRouterFrameImage[]
  inputReferences: OpenRouterVideoReference[]
  referenceCounts: Readonly<{
    audio: number
    image: number
    video: number
  }>
}
