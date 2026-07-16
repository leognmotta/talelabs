import type { GenerationModelDefinition } from '../registry/types.js'

import { GENERATION_MODEL_CONTRACT_VERSION } from '../registry/contracts.js'
import { getGenerationModel } from '../registry/queries/lookup.js'

const GENERATION_MODEL_NON_CONTRACT_FIELDS = new Set([
  'advanced',
  'capabilitySchemaVersion',
  'descriptionKey',
  'displayName',
  'enabled',
  'executionAvailable',
  'labelKey',
  'nodeType',
  'presentation',
  'provider',
  'recommended',
])
const generationModelContractSignatures = new WeakMap<object, string>()

function canonicalGenerationModelContract(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(canonicalGenerationModelContract)
  if (!value || typeof value !== 'object')
    return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !GENERATION_MODEL_NON_CONTRACT_FIELDS.has(key))
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalGenerationModelContract(nested)]),
  )
}

function generationModelContractSignature(model: GenerationModelDefinition) {
  const cached = generationModelContractSignatures.get(model)
  if (cached)
    return cached
  const signature = JSON.stringify(canonicalGenerationModelContract(model))
  generationModelContractSignatures.set(model, signature)
  return signature
}

/** Compares one model's creative contract across immutable snapshots. */
export function areGenerationModelContractsEquivalent(
  modelId: string,
  leftContractVersion: unknown,
  rightContractVersion: unknown = GENERATION_MODEL_CONTRACT_VERSION,
) {
  const left = getGenerationModel(modelId, leftContractVersion)
  const right = getGenerationModel(modelId, rightContractVersion)
  return Boolean(left && right
    && generationModelContractSignature(left)
    === generationModelContractSignature(right))
}
