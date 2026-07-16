import type { GenerationModelContractVersion } from '../contracts.js'

import { GENERATION_MODEL_CONTRACTS } from '../contracts.js'

export function isGenerationModelContractVersion(
  value: unknown,
): value is GenerationModelContractVersion {
  return typeof value === 'string' && value in GENERATION_MODEL_CONTRACTS
}
