/**
 * Mutable Flow model-contract compatibility checks.
 *
 * Historical execution compatibility now belongs to self-contained run
 * snapshots, so draft compatibility only needs the current catalog format.
 *
 */

import { GENERATION_MODEL_CONTRACT_VERSION } from '../registry/contracts.js'
import { getGenerationModel } from '../registry/queries/lookup.js'

/**
 * Compares two current draft contracts for the same canonical model.
 *
 * @param modelId - Canonical model identity.
 * @param leftContractVersion - First draft contract version.
 * @param rightContractVersion - Second draft contract version.
 * @returns `true` only when both resolve to the current catalog definition.
 */
export function areGenerationModelContractsEquivalent(
  modelId: string,
  leftContractVersion: unknown,
  rightContractVersion: unknown = GENERATION_MODEL_CONTRACT_VERSION,
) {
  return Boolean(
    getGenerationModel(modelId, leftContractVersion)
    && getGenerationModel(modelId, rightContractVersion),
  )
}
