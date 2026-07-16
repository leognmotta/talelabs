/**
 * Offline validation for the catalog-backed Flow generation contract.
 *
 */

import { MODEL_CATALOG, validateModelCatalog } from '@talelabs/models-catalog'
import {
  DEFAULT_GENERATION_MODEL_IDS,
  GENERATION_MODEL_REGISTRY,
  validateFlowNodeRegistry,
  validateGenerationCapabilityScenarios,
  validateHardenedGenerationRegistry,
} from '../src/index.js'

function isDeeplyFrozen(value: unknown): boolean {
  return !value || typeof value !== 'object'
    ? true
    : Object.isFrozen(value) && Object.values(value).every(isDeeplyFrozen)
}

const errors = [
  ...validateModelCatalog(MODEL_CATALOG),
  ...validateFlowNodeRegistry(),
  ...validateHardenedGenerationRegistry(GENERATION_MODEL_REGISTRY),
  ...validateGenerationCapabilityScenarios(),
]

if (Object.keys(GENERATION_MODEL_REGISTRY).length !== MODEL_CATALOG.models.length)
  errors.push('Flow registry must contain every catalog model exactly once')
if (!isDeeplyFrozen(GENERATION_MODEL_REGISTRY))
  errors.push('Flow model projection must be deeply frozen')
if (Object.keys(GENERATION_MODEL_REGISTRY).some(id => id.startsWith('talelabs/')))
  errors.push('Flow model identities must use canonical vendor/model IDs')
if (JSON.stringify(DEFAULT_GENERATION_MODEL_IDS) !== JSON.stringify(MODEL_CATALOG.defaults))
  errors.push('Flow defaults must be the catalog defaults')
if (Object.values(GENERATION_MODEL_REGISTRY).some(model =>
  Object.hasOwn(model, 'bindings') || Object.hasOwn(model, 'provider'))) {
  errors.push('Flow model projection must not contain private provider policy')
}

if (errors.length)
  throw new Error(`Invalid generation registry:\n${errors.join('\n')}`)

console.log(
  `Validated ${MODEL_CATALOG.models.length} catalog-backed Flow models and deterministic capability scenarios.`,
)
