/**
 * Narrow execution types shared by the fal queue protocol modules.
 */

import type { BrowserFalProviderBinding } from '@talelabs/models-catalog'
import type { ProviderAssetResolver } from '../contracts.js'

export type { FalRuntimeCredential } from '../contracts.js'

/** Tenant-aware resolver injected by the runtime without leaking data access. */
export type FalAssetResolver = ProviderAssetResolver

/**
 * Binding facts the queue adapter needs. The full and browser catalog bindings
 * both satisfy this narrow shape, so one adapter serves managed and browser
 * execution without knowing which reviewed binding produced it.
 */
export type FalQueueBinding = BrowserFalProviderBinding
