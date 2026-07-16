/** Versioned private media fixtures used by deterministic debug execution. */

import type { GenerationMediaType } from '@talelabs/flows'

import { TALELABS_PRIVATE_BUCKET } from '@talelabs/storage'

/** Version identifying the immutable debug-mode media fixture set. */
export const MOCK_FIXTURE_CATALOG_VERSION = 'mock-generation-fixtures-v1'

/** Metadata and private-storage address for one deterministic mock fixture. */
export interface MockGenerationFixture {
  catalogVersion: typeof MOCK_FIXTURE_CATALOG_VERSION
  checksumSha256: string
  durationSeconds?: number
  height?: number
  id: string
  license: string
  mediaType: GenerationMediaType
  mimeType: string
  source: string
  storage: {
    bucket: string
    key: string
  }
  width?: number
}

/** Canonical fixed fixtures available to debug-mode provider adapters. */
export const MOCK_GENERATION_FIXTURES: readonly Readonly<MockGenerationFixture>[]
  = Object.freeze([
    Object.freeze({
      catalogVersion: MOCK_FIXTURE_CATALOG_VERSION,
      checksumSha256: 'c11bf7c67bd722ed00e14dc9f096d1d69a98448b04d6fb78c0ffe6ff8819575d',
      height: 180,
      id: 'talelabs-image-v1',
      license: 'TaleLabs-owned',
      mediaType: 'image',
      mimeType: 'image/svg+xml',
      source: 'repository-generated',
      storage: Object.freeze({
        bucket: TALELABS_PRIVATE_BUCKET,
        key: 'system/mock-generation/v1/image/talelabs-image-v1.svg',
      }),
      width: 320,
    }),
    Object.freeze({
      catalogVersion: MOCK_FIXTURE_CATALOG_VERSION,
      checksumSha256: 'bdcd2ff8abf2526150230a23ed17b17b685908e26014218cdafb3e6541e42d87',
      durationSeconds: 1,
      id: 'talelabs-audio-v1',
      license: 'TaleLabs-owned',
      mediaType: 'audio',
      mimeType: 'audio/wav',
      source: 'repository-generated',
      storage: Object.freeze({
        bucket: TALELABS_PRIVATE_BUCKET,
        key: 'system/mock-generation/v1/audio/talelabs-audio-v1.wav',
      }),
    }),
    Object.freeze({
      catalogVersion: MOCK_FIXTURE_CATALOG_VERSION,
      checksumSha256: '17892f5df667dfa82f70eb72e1d93553d88bf4dce083005459673712b5fc9732',
      durationSeconds: 0.25,
      height: 90,
      id: 'talelabs-video-v1',
      license: 'TaleLabs-owned',
      mediaType: 'video',
      mimeType: 'video/mp4',
      source: 'repository-generated',
      storage: Object.freeze({
        bucket: TALELABS_PRIVATE_BUCKET,
        key: 'system/mock-generation/v1/video/talelabs-video-v1.mp4',
      }),
      width: 160,
    }),
  ] as const satisfies readonly MockGenerationFixture[])

/** Maps equivalent normalized requests to equivalent versioned fixture bytes. */
export function selectMockGenerationFixture(input: {
  mediaType: GenerationMediaType
  outputIndex: number
}) {
  const compatible = MOCK_GENERATION_FIXTURES.filter(
    fixture => fixture.mediaType === input.mediaType,
  )
  if (!compatible.length)
    throw new Error('generation_fixture_unavailable')
  return compatible[input.outputIndex % compatible.length]!
}
