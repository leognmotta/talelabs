import { createHash } from 'node:crypto'

import {
  getObject,
  putObject,
} from '@talelabs/storage'

import {
  MOCK_GENERATION_FIXTURES,
} from '../src/generation/adapters/mock/fixture-catalog.js'
import { MOCK_FIXTURE_SOURCE_BYTES } from './mock-fixture-sources.js'

function checksum(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex')
}

export async function seedMockGenerationFixtures() {
  for (const fixture of MOCK_GENERATION_FIXTURES) {
    const bytes = MOCK_FIXTURE_SOURCE_BYTES[fixture.id]
    if (checksum(bytes) !== fixture.checksumSha256)
      throw new Error(`Fixture source checksum mismatch: ${fixture.id}`)
    await putObject({
      body: bytes,
      bucket: fixture.storage.bucket,
      contentType: fixture.mimeType,
      key: fixture.storage.key,
      metadata: {
        catalogVersion: fixture.catalogVersion,
        checksumSha256: fixture.checksumSha256,
        fixtureId: fixture.id,
        license: fixture.license,
      },
    })
  }
}

export async function verifyMockGenerationFixtures() {
  for (const fixture of MOCK_GENERATION_FIXTURES) {
    const object = await getObject({
      bucket: fixture.storage.bucket,
      key: fixture.storage.key,
    })
    if (!object.Body)
      throw new Error(`Fixture body missing: ${fixture.id}`)
    const bytes = await object.Body.transformToByteArray()
    if (checksum(bytes) !== fixture.checksumSha256)
      throw new Error(`Stored fixture checksum mismatch: ${fixture.id}`)
    if (object.ContentType !== fixture.mimeType)
      throw new Error(`Stored fixture MIME mismatch: ${fixture.id}`)
  }
}
