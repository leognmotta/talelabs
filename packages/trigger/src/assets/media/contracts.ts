import type { AssetType, JsonValue } from '@talelabs/db'
import type { Buffer } from 'node:buffer'

export interface MediaProcessingResult {
  durationSeconds: null | number
  height: null | number
  metadata: JsonValue
  thumbnail: Buffer | null
  width: null | number
}

export interface MediaProcessorInput {
  directory: string
  sourcePath: string
}

export interface MediaProcessor {
  process: (input: MediaProcessorInput) => Promise<MediaProcessingResult>
}

export type ProcessableAssetType = Extract<
  AssetType,
  'audio' | 'image' | 'video'
>

export class InvalidMediaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidMediaError'
  }
}
