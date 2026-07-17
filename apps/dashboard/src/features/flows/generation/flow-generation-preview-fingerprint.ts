/** Stable request fingerprinting for mock-runtime deduplication and filenames. */

import type { GenerationMockRequest } from './flow-generation-preview-request'

/** Produces the versioned deterministic fingerprint used by mocked generation. */
export function fingerprintGenerationMockRequest(
  request: GenerationMockRequest,
) {
  const value = JSON.stringify(request)
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return `generation-mock-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`
}
