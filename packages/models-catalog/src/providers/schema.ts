/**
 * Provider-discriminated private binding contract for the model catalog.
 */

import type {
  BrowserFalProviderBinding,
  CatalogFalProviderBinding,
} from './fal/index.js'
import type {
  BrowserOpenRouterProviderBinding,
  CatalogOpenRouterProviderBinding,
} from './openrouter.js'

import { z } from 'zod'
import {
  BrowserFalProviderBindingSchema,
  CatalogFalProviderBindingSchema,
  toBrowserFalProviderBinding,
} from './fal/index.js'
import {
  BrowserOpenRouterProviderBindingSchema,
  CatalogOpenRouterProviderBindingSchema,
  toBrowserOpenRouterProviderBinding,
} from './openrouter.js'

/** Private provider binding variants supported by the current catalog. */
export type CatalogProviderBinding
  = | CatalogFalProviderBinding
    | CatalogOpenRouterProviderBinding

/**
 * Strict provider-discriminated schema. A future provider adds one isolated
 * schema variant to this union without changing model capability contracts.
 */
export const CatalogProviderBindingSchema = z.discriminatedUnion(
  'provider',
  [CatalogOpenRouterProviderBindingSchema, CatalogFalProviderBindingSchema],
) satisfies z.ZodType<CatalogProviderBinding>

/** Narrow provider binding variants a browser lease may receive. */
export type BrowserCatalogProviderBinding
  = | BrowserFalProviderBinding
    | BrowserOpenRouterProviderBinding

/** Strict wire schema for the narrow browser-disclosed provider binding. */
export const BrowserCatalogProviderBindingSchema = z.discriminatedUnion(
  'provider',
  [BrowserOpenRouterProviderBindingSchema, BrowserFalProviderBindingSchema],
) satisfies z.ZodType<BrowserCatalogProviderBinding>

/** Projects one reviewed binding onto its narrow browser-disclosed form. */
export function toBrowserCatalogProviderBinding(
  binding: CatalogProviderBinding,
): BrowserCatalogProviderBinding {
  switch (binding.provider) {
    case 'fal':
      return toBrowserFalProviderBinding(binding)
    case 'openrouter':
      return toBrowserOpenRouterProviderBinding(binding)
  }
}
