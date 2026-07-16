import { GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2 } from '../../generation/registry/index.js'

export function addGenerationModelContractVersion(data: unknown) {
  return {
    ...(data as Record<string, unknown>),
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION_2026_07_12_2,
  }
}

export function addLockedState<T extends Record<string, unknown>>(data: T) {
  return { ...data, locked: false }
}
