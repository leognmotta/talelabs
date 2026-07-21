/** Browser-safe fal binding projection and its strict wire schema. */

import type { CatalogFalProviderBinding } from './contracts.js'

import { z } from 'zod'
import { CatalogProviderLifecycleSchema } from '../contracts.js'
import { FAL_QUEUE_BASE } from './contracts.js'
import { FalRequestProfileSchema } from './schemas.js'

/** Binding facts the browser adapter needs; excludes review and policy fields. */
type BrowserFalBindingKeys
  = | 'endpoint'
    | 'lifecycle'
    | 'nativeModelId'
    | 'operationId'
    | 'protocol'
    | 'provider'
    | 'providerTag'
    | 'requestProfile'

/** Narrow fal binding disclosed to the browser execution driver. */
export type BrowserFalProviderBinding = Pick<
  CatalogFalProviderBinding,
  BrowserFalBindingKeys
>

/** Strict wire schema for the narrow browser-disclosed fal binding. */
export const BrowserFalProviderBindingSchema = z.object({
  endpoint: z.literal(FAL_QUEUE_BASE),
  lifecycle: CatalogProviderLifecycleSchema,
  nativeModelId: z.string().regex(/^[^/]+\/.+$/),
  operationId: z.string().min(1),
  protocol: z.literal('queue'),
  provider: z.literal('fal'),
  providerTag: z.literal('fal-queue'),
  requestProfile: FalRequestProfileSchema,
}).strict() satisfies z.ZodType<BrowserFalProviderBinding>

/** Projects one reviewed fal binding onto its narrow browser-disclosed form. */
export function toBrowserFalProviderBinding(
  binding: CatalogFalProviderBinding,
): BrowserFalProviderBinding {
  return {
    endpoint: binding.endpoint,
    lifecycle: binding.lifecycle,
    nativeModelId: binding.nativeModelId,
    operationId: binding.operationId,
    protocol: binding.protocol,
    provider: binding.provider,
    providerTag: binding.providerTag,
    requestProfile: binding.requestProfile,
  }
}
