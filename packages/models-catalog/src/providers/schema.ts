/**
 * Provider-discriminated private binding contract for the model catalog.
 */

import type { CatalogOpenRouterProviderBinding } from './openrouter.js'

import { z } from 'zod'
import { CatalogOpenRouterProviderBindingSchema } from './openrouter.js'

/** Private provider binding variants supported by the current catalog. */
export type CatalogProviderBinding = CatalogOpenRouterProviderBinding

/**
 * Strict provider-discriminated schema. A future provider adds one isolated
 * schema variant to this union without changing model capability contracts.
 */
export const CatalogProviderBindingSchema = z.discriminatedUnion(
  'provider',
  [CatalogOpenRouterProviderBindingSchema],
) satisfies z.ZodType<CatalogProviderBinding>
