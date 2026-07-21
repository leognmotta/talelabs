/**
 * Private provider-binding lookup and mode-aware selection for run admission.
 *
 * Workers must execute the resolved binding captured in an immutable run
 * snapshot; they must not call this lookup again during retries.
 *
 */

import type { CatalogProviderBinding } from './providers/schema.js'
import { getCatalogModel } from './catalog.js'

/** Stable provider discriminator recorded in bindings, jobs, and snapshots. */
export type CatalogProviderId = CatalogProviderBinding['provider']

/**
 * Lists provider bindings for one current model operation in priority order.
 *
 * @param modelId - Canonical `vendor/model` identity.
 * @param operationId - Stable provider-neutral operation ID.
 * @returns Immutable bindings ordered from highest to lowest priority.
 */
export function getCatalogProviderBindings(
  modelId: string,
  operationId: string,
) {
  const model = getCatalogModel(modelId)
  return Object.freeze((model?.bindings ?? [])
    .filter(binding => binding.operationId === operationId)
    .toSorted((left, right) => right.priority - left.priority))
}

/**
 * Resolves the preferred provider binding used for new run admission.
 *
 * @param modelId - Canonical `vendor/model` identity.
 * @param operationId - Stable provider-neutral operation ID.
 * @returns The highest-priority binding, or `undefined` when unsupported.
 */
export function getCatalogProviderBinding(
  modelId: string,
  operationId: string,
) {
  return getCatalogProviderBindings(modelId, operationId)[0]
}

/**
 * Selects one runtime-compatible binding from an explicit candidate set.
 *
 * Keeping priority ordering inside this pure boundary lets admission use the
 * checked-in catalog while verification can safely invert cloned priorities
 * without mutating global catalog state.
 *
 * @param input - Candidate binding selection inputs.
 * @param input.availableProviders - Providers holding a usable credential now.
 * @param input.bindings - Candidate bindings for one model operation.
 * @param input.executionRuntime - Where the authenticated request is sent from.
 * @returns The highest-priority usable binding, or `undefined` when none qualifies.
 */
export function selectProviderBindingFromCandidates(input: {
  availableProviders: ReadonlySet<CatalogProviderId>
  bindings: readonly CatalogProviderBinding[]
  executionRuntime: 'browser' | 'managed'
}): CatalogProviderBinding | undefined {
  return input.bindings
    .toSorted((left, right) => right.priority - left.priority)
    .find(binding =>
      binding.executionRuntimes.includes(input.executionRuntime)
      && input.availableProviders.has(binding.provider),
    )
}

/**
 * Selects the binding a live run should admit for one execution mode.
 *
 * Selection walks bindings from highest to lowest priority and returns the first
 * whose provider both physically supports the requested runtime and has a usable
 * credential in this run's mode. This is the single control point for provider
 * routing: catalog priority decides the preferred provider per model, while the
 * mode's available-provider set decides which providers may serve it — TaleLabs'
 * platform-key set for credits, the user's connected keys for BYOK.
 *
 * @param input - Selection inputs.
 * @param input.availableProviders - Providers holding a usable credential now.
 * @param input.executionRuntime - Where the authenticated request is sent from.
 * @param input.modelId - Canonical `vendor/model` identity.
 * @param input.operationId - Stable provider-neutral operation ID.
 * @returns The preferred usable binding, or `undefined` when none qualifies.
 */
export function selectProviderBinding(input: {
  availableProviders: ReadonlySet<CatalogProviderId>
  executionRuntime: 'browser' | 'managed'
  modelId: string
  operationId: string
}): CatalogProviderBinding | undefined {
  return selectProviderBindingFromCandidates({
    availableProviders: input.availableProviders,
    bindings: getCatalogProviderBindings(input.modelId, input.operationId),
    executionRuntime: input.executionRuntime,
  })
}
