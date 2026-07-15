import type {
  GenerationProviderDelivery,
  NormalizedGenerationOutput,
} from './generation-provider-contracts.js'
import type {
  GenerationOutputType,
} from './generation-registry-types.js'

export type GenerationProviderOutputValidationCode
  = | 'generation_output_count_mismatch'
    | 'generation_output_delivery_invalid'
    | 'generation_output_index_duplicate'
    | 'generation_output_index_gap'
    | 'generation_output_media_type_mismatch'
    | 'generation_output_mime_type_invalid'

export class GenerationProviderOutputValidationError extends TypeError {
  readonly code: GenerationProviderOutputValidationCode

  constructor(code: GenerationProviderOutputValidationCode) {
    super(code)
    this.code = code
    this.name = 'GenerationProviderOutputValidationError'
  }
}

function baseMimeType(value: string) {
  return value.split(';', 1)[0]!.trim().toLowerCase()
}

function isCompatibleMimeType(
  mediaType: GenerationOutputType,
  mimeType: string,
) {
  const normalized = baseMimeType(mimeType)
  if (mediaType === 'text')
    return normalized === 'text/plain'
  return normalized.startsWith(`${mediaType}/`)
}

function isCompatibleDelivery(
  mediaType: GenerationOutputType,
  delivery: GenerationProviderDelivery,
) {
  return mediaType === 'text' ? delivery === 'text' : delivery !== 'text'
}

/**
 * Validates the complete provider result as one atomic contract before any
 * output is persisted. Output order from a provider is irrelevant; indexes
 * are the canonical, contiguous identity of the requested result slots.
 */
export function validateGenerationProviderOutputs(input: {
  allowedDeliveries: readonly GenerationProviderDelivery[]
  expectedCount: number
  expectedMediaType: GenerationOutputType
  outputs: readonly NormalizedGenerationOutput[]
}): readonly NormalizedGenerationOutput[] {
  if (input.outputs.length !== input.expectedCount) {
    throw new GenerationProviderOutputValidationError(
      'generation_output_count_mismatch',
    )
  }

  const indexes = new Set<number>()
  for (const output of input.outputs) {
    if (output.mediaType !== input.expectedMediaType) {
      throw new GenerationProviderOutputValidationError(
        'generation_output_media_type_mismatch',
      )
    }
    if (
      !input.allowedDeliveries.includes(output.payload.delivery)
      || !isCompatibleDelivery(output.mediaType, output.payload.delivery)
    ) {
      throw new GenerationProviderOutputValidationError(
        'generation_output_delivery_invalid',
      )
    }
    if (!isCompatibleMimeType(output.mediaType, output.payload.mimeType)) {
      throw new GenerationProviderOutputValidationError(
        'generation_output_mime_type_invalid',
      )
    }
    if (indexes.has(output.outputIndex)) {
      throw new GenerationProviderOutputValidationError(
        'generation_output_index_duplicate',
      )
    }
    indexes.add(output.outputIndex)
  }

  const outputs = [...input.outputs].toSorted(
    (left, right) => left.outputIndex - right.outputIndex,
  )
  for (const [expectedIndex, output] of outputs.entries()) {
    if (output.outputIndex !== expectedIndex) {
      throw new GenerationProviderOutputValidationError(
        'generation_output_index_gap',
      )
    }
  }
  return Object.freeze(outputs)
}
