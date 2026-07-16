/**
 * Internal wire shapes for the OpenRouter video protocol.
 *
 */

import type { NormalizedGenerationMediaAsset } from '@talelabs/flows'

/** One ordered media input and its normalized target slot. */
export interface OrderedVideoMediaInput {
  asset: NormalizedGenerationMediaAsset
  targetSlotId: string
}

/** OpenRouter frame-image request shape. */
export interface OpenRouterFrameImage {
  frame_type: 'first_frame' | 'last_frame'
  image_url: { url: string }
  type: 'image_url'
}

/** OpenRouter media-reference request shape. */
export type OpenRouterVideoReference
  = | { audio_url: { url: string }, type: 'audio_url' }
    | { image_url: { url: string }, type: 'image_url' }
    | { type: 'video_url', video_url: { url: string } }

/** Fully resolved provider video inputs. */
export interface OpenRouterVideoInputs {
  frameImages: OpenRouterFrameImage[]
  inputReferences: OpenRouterVideoReference[]
  referenceCounts: Readonly<{
    audio: number
    image: number
    video: number
  }>
}
