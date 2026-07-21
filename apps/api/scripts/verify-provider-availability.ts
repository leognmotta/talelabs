/** Offline admission checks for managed provider readiness and fallback. */

import assert from 'node:assert/strict'

import {
  GENERATION_CATALOG_REVISION,
  GENERATION_MODEL_CONTRACT_VERSION,
  toBrowserExecutionContract,
} from '@talelabs/flows'
import {
  getCatalogModel,
  getCatalogProviderBindings,
  MODEL_CATALOG,
  selectProviderBinding,
  selectProviderBindingFromCandidates,
} from '@talelabs/models-catalog'
import { generationExecutionContracts } from '../src/domain/runs/generation-execution-contracts.js'
import { availableProvidersForRun } from '../src/domain/runs/provider-availability.js'

const openRouterOnlyProviders = availableProvidersForRun(
  'managed',
  undefined,
  provider => provider === 'openrouter',
)
assert.deepEqual([...openRouterOnlyProviders], ['openrouter'])
assert.equal(selectProviderBinding({
  availableProviders: openRouterOnlyProviders,
  executionRuntime: 'managed',
  modelId: 'black-forest-labs/flux.2-pro',
  operationId: 'textToImage',
})?.provider, 'openrouter')

const allReadyProviders = availableProvidersForRun(
  'managed',
  undefined,
  () => true,
)
assert.equal(selectProviderBinding({
  availableProviders: allReadyProviders,
  executionRuntime: 'managed',
  modelId: 'black-forest-labs/flux.2-pro',
  operationId: 'textToImage',
})?.provider, 'fal')

const seedance = getCatalogModel('bytedance/seedance-2.0')
assert.ok(seedance)
const seedanceOperations = [
  'textToVideo',
  'firstLastFrameToVideo',
  'referencesToVideo',
] as const
const seedancePlan = {
  executionNodes: seedanceOperations.map((operationId, index) => ({
    catalogRevision: GENERATION_CATALOG_REVISION,
    catalogVersion: MODEL_CATALOG.catalogVersion,
    modelContractVersion: GENERATION_MODEL_CONTRACT_VERSION,
    modelId: seedance.id,
    modelRevision: seedance.revision,
    nodeId: `seedance-node-${index}`,
    operationId,
  })),
}

const dualProviderBindings = getCatalogProviderBindings(
  seedance.id,
  'textToVideo',
)
assert.deepEqual(
  dualProviderBindings.map(binding => binding.provider),
  ['openrouter', 'fal'],
  'Seedance text-to-video must retain two exact provider candidates',
)
const bothProviders = new Set(['fal', 'openrouter'] as const)
function bindingsWithPreferredProvider(preferredProvider: 'fal' | 'openrouter') {
  return dualProviderBindings.map(binding => ({
    ...binding,
    priority: binding.provider === preferredProvider ? 300 : 100,
  }))
}
for (const executionRuntime of ['managed', 'browser'] as const) {
  assert.equal(
    selectProviderBindingFromCandidates({
      availableProviders: bothProviders,
      bindings: bindingsWithPreferredProvider('fal'),
      executionRuntime,
    })?.provider,
    'fal',
    `${executionRuntime} selection must honor fal's higher fixture priority`,
  )
  assert.equal(
    selectProviderBindingFromCandidates({
      availableProviders: bothProviders,
      bindings: bindingsWithPreferredProvider('openrouter'),
      executionRuntime,
    })?.provider,
    'openrouter',
    `${executionRuntime} selection must honor OpenRouter's higher fixture priority`,
  )
}

const capturedOpenRouterContracts = generationExecutionContracts(
  seedancePlan,
  'managed',
  'live',
  allReadyProviders,
)
assert.deepEqual(
  capturedOpenRouterContracts.map(contract => contract.provider),
  ['openrouter', 'openrouter', 'openrouter'],
)
const seedanceFalOnlyProviders = availableProvidersForRun(
  'managed',
  undefined,
  provider => provider === 'fal',
)
const fallbackContracts = generationExecutionContracts(
  seedancePlan,
  'managed',
  'live',
  seedanceFalOnlyProviders,
)
assert.deepEqual(
  fallbackContracts.map(contract => contract.provider),
  ['fal', 'fal', 'fal'],
)
assert.deepEqual(
  capturedOpenRouterContracts.map(contract => contract.provider),
  ['openrouter', 'openrouter', 'openrouter'],
  'captured bindings must not reroute after availability changes',
)
const capturedBrowserContracts = generationExecutionContracts(
  seedancePlan,
  'browser',
  'live',
  availableProvidersForRun('browser', ['openrouter', 'fal']),
)
assert.deepEqual(
  capturedBrowserContracts.map(contract => contract.provider),
  ['openrouter', 'openrouter', 'openrouter'],
  'browser admission with both keys must capture the higher-priority provider',
)
assert.deepEqual(
  capturedBrowserContracts.map(contract => contract.providerBinding.provider),
  ['openrouter', 'openrouter', 'openrouter'],
  'browser execution must dispatch from the captured binding, not repick later',
)
const browserExecutionContracts = capturedBrowserContracts.map(
  toBrowserExecutionContract,
)
assert.deepEqual(
  browserExecutionContracts.map(contract => contract.providerBinding.provider),
  ['openrouter', 'openrouter', 'openrouter'],
  'the browser projection must retain the provider selected at admission',
)
assert.equal(
  browserExecutionContracts.every(
    contract => !('priority' in contract.providerBinding),
  ),
  true,
  'the browser must receive one captured binding rather than routing policy',
)

const noManagedProviders = availableProvidersForRun(
  'managed',
  undefined,
  () => false,
)
assert.throws(() => generationExecutionContracts(
  seedancePlan,
  'managed',
  'live',
  noManagedProviders,
))
assert.deepEqual(
  generationExecutionContracts(
    seedancePlan,
    'managed',
    'debug',
    noManagedProviders,
  ).map(contract => contract.provider),
  ['openrouter', 'openrouter', 'openrouter'],
)

assert.equal(selectProviderBinding({
  availableProviders: availableProvidersForRun('browser', ['fal']),
  executionRuntime: 'browser',
  modelId: seedance.id,
  operationId: 'textToVideo',
})?.provider, 'fal')
assert.equal(selectProviderBinding({
  availableProviders: availableProvidersForRun('browser', ['openrouter']),
  executionRuntime: 'browser',
  modelId: seedance.id,
  operationId: 'textToVideo',
})?.provider, 'openrouter')
assert.equal(
  availableProvidersForRun('browser').size,
  0,
  'browser admission without current credential readiness must fail closed',
)

console.log(
  'Verified managed/browser priority, fail-closed readiness, immutable capture, fallback, and debug execution.',
)
