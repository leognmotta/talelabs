/**
 * Current catalog-format contract validation for mutable Flow drafts.
 *
 */

import type { GenerationModelContractVersion } from '../contracts.js'

import { GENERATION_MODEL_CONTRACT_VERSION } from '../contracts.js'

/** Returns whether a value names the current catalog-backed Flow contract. */
export function isGenerationModelContractVersion(
  value: unknown,
): value is GenerationModelContractVersion {
  return value === GENERATION_MODEL_CONTRACT_VERSION
}
