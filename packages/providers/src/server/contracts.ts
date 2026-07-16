/**
 * Server-only adapter-construction contracts used by durable orchestration.
 */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { CatalogProviderBinding } from '@talelabs/models-catalog'
import type {
  ProviderAssetResolver,
  ProviderRuntimeCredential,
} from '../contracts.js'

/** Inputs used only while constructing a managed provider adapter in memory. */
export interface ProviderAdapterRuntimeInput {
  /** Exact private binding captured in the immutable run snapshot. */
  binding: CatalogProviderBinding
  /** Optional non-serializable credential selected by server composition. */
  credential?: ProviderRuntimeCredential
  /** Tenant-aware resolver for authorized provider input URLs and metadata. */
  resolveAsset: ProviderAssetResolver
}

/** Registered provider implementation returned to durable orchestration. */
export interface RegisteredProviderAdapter {
  /** Normalized adapter executed by the provider-neutral lifecycle runner. */
  adapter: NormalizedGenerationProviderAdapter
  /** Whether persistence must complete before a paid request is submitted. */
  requiresDurableSubmissionBoundary: boolean
}
