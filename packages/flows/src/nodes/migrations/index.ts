/** Flow node migration dispatch for saved graph data. */

import { GENERATION_MODEL_CONTRACT_VERSION } from '../../generation/registry/index.js'

/** Adds the current model-contract discriminator to migration-safe object data. */
export function addGenerationModelContractVersion(data: unknown) {
  return {
    ...(data as Record<string, unknown>),
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
  }
}

/** Adds the default editable lock state to migration-safe object data. */
export function addLockedState<T extends Record<string, unknown>>(data: T) {
  return { ...data, locked: false }
}
