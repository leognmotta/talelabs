/**
 * Provider-discriminated compatibility validation for private bindings.
 */

import type { CatalogModelRecord } from '../schema.js'
import type { CatalogProviderBinding } from './schema.js'

import { validateOpenRouterBindingCompatibility } from './openrouter.js'

/** Dispatches one binding to the validator owned by its provider. */
export function validateProviderBinding(
  model: CatalogModelRecord,
  binding: CatalogProviderBinding,
): string[] {
  switch (binding.provider) {
    case 'openrouter':
      return validateOpenRouterBindingCompatibility(model, binding)
  }
}
