/**
 * Sanitized model catalog projection for API and dashboard consumers.
 *
 * Provider bindings, endpoint policy, and request profiles are removed here
 * rather than relying on callers to remember an omission list.
 *
 */

import type { CatalogModelRecord } from './schema.js'

import { MODEL_CATALOG } from './catalog.js'

/** Public model shape with every private provider binding removed. */
export type PublicCatalogModel = Omit<CatalogModelRecord, 'bindings'>

/** Sanitized current catalog safe for serialization by the API. */
export const PUBLIC_MODEL_CATALOG = Object.freeze({
  catalogVersion: MODEL_CATALOG.catalogVersion,
  catalogRevision: MODEL_CATALOG.catalogRevision,
  defaults: MODEL_CATALOG.defaults,
  models: Object.freeze(MODEL_CATALOG.models
    .filter(model => model.status !== 'retired')
    .map((model) => {
      const { bindings: _privateBindings, ...publicModel } = model
      return Object.freeze(publicModel)
    })),
})

/** Active public models that may be selected by newly edited Flow nodes. */
export const SELECTABLE_CATALOG_MODELS = Object.freeze(
  PUBLIC_MODEL_CATALOG.models.filter(model => model.status === 'active'),
)
