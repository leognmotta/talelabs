/** Conservative generated-output storage holds owned with model capabilities. */

import type { CatalogMediaType } from './schema.js'

import { getCatalogModel } from './catalog.js'

const OUTPUT_STORAGE_RESERVATION_BYTES = {
  audio: 100 * 1024 * 1024,
  image: 50 * 1024 * 1024,
  text: 0,
  video: 100 * 1024 * 1024,
} as const satisfies Record<CatalogMediaType, number>

/** Returns conservative bytes held for one model job's planned output count. */
export function getGenerationOutputStorageReservationBytes(input: {
  /** Canonical creative model identity. */
  modelId: string
  /** Bounded output count captured by the job request. */
  outputCount: number
}) {
  const model = getCatalogModel(input.modelId)
  if (!model)
    throw new RangeError(`Unknown generation model: ${input.modelId}`)
  if (!Number.isSafeInteger(input.outputCount) || input.outputCount < 1)
    throw new RangeError('Generation output count must be a positive integer.')
  return OUTPUT_STORAGE_RESERVATION_BYTES[model.mediaType] * input.outputCount
}
