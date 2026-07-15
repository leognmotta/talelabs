import type {
  GenerationProviderDelivery,
  NormalizedGenerationOutput,
} from '../src/index.js'

import {
  GenerationProviderOutputValidationError,
  validateGenerationProviderOutputs,
} from '../src/index.js'

function output(
  outputIndex: number,
  overrides: Partial<NormalizedGenerationOutput> = {},
): NormalizedGenerationOutput {
  return {
    mediaType: 'image',
    outputIndex,
    payload: {
      bytes: new Uint8Array([outputIndex]),
      delivery: 'bytes',
      mimeType: 'image/png',
    },
    ...overrides,
  }
}

function expectFailure(
  code: GenerationProviderOutputValidationError['code'],
  input: {
    allowedDeliveries?: readonly GenerationProviderDelivery[]
    expectedCount?: number
    outputs: readonly NormalizedGenerationOutput[]
  },
) {
  try {
    validateGenerationProviderOutputs({
      allowedDeliveries: input.allowedDeliveries ?? ['bytes'],
      expectedCount: input.expectedCount ?? 2,
      expectedMediaType: 'image',
      outputs: input.outputs,
    })
  }
  catch (error) {
    if (
      error instanceof GenerationProviderOutputValidationError
      && error.code === code
    ) {
      return
    }
    throw error
  }
  throw new Error(`Expected ${code}`)
}

const valid = validateGenerationProviderOutputs({
  allowedDeliveries: ['bytes'],
  expectedCount: 2,
  expectedMediaType: 'image',
  outputs: [output(1), output(0)],
})
if (valid.map(item => item.outputIndex).join(',') !== '0,1')
  throw new Error('Valid provider outputs must be returned in canonical order')

expectFailure('generation_output_count_mismatch', {
  outputs: [output(0)],
})
expectFailure('generation_output_index_duplicate', {
  outputs: [output(0), output(0)],
})
expectFailure('generation_output_index_gap', {
  outputs: [output(0), output(2)],
})
expectFailure('generation_output_media_type_mismatch', {
  outputs: [output(0), output(1, { mediaType: 'video' })],
})
expectFailure('generation_output_delivery_invalid', {
  allowedDeliveries: ['url'],
  outputs: [output(0), output(1)],
})
expectFailure('generation_output_delivery_invalid', {
  allowedDeliveries: ['text'],
  outputs: [
    output(0, {
      payload: {
        delivery: 'text',
        mimeType: 'text/plain',
        text: 'not an image',
      },
    }),
    output(1, {
      payload: {
        delivery: 'text',
        mimeType: 'text/plain',
        text: 'not an image',
      },
    }),
  ],
})
expectFailure('generation_output_mime_type_invalid', {
  outputs: [
    output(0),
    output(1, {
      payload: {
        bytes: new Uint8Array([1]),
        delivery: 'bytes',
        mimeType: 'video/mp4',
      },
    }),
  ],
})

console.log('Generation provider output contracts are valid')
