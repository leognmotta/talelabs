/**
 * Cross-record validation for model capabilities and private bindings.
 *
 * The checks here fail catalog startup before API admission or a provider
 * request can observe an incomplete model record.
 *
 */

import type {
  CatalogModelRecord,
  ModelCatalog,
} from './schema.js'
import { browserBindingIncompatibilities } from './providers/browser-compat.js'
import { validateProviderBinding } from './providers/validation.js'

function validateModel(model: CatalogModelRecord): string[] {
  const errors: string[] = []
  const operationIds = model.operations.map(operation => operation.id)
  const slotIds = model.inputSlots.map(slot => slot.id)
  const settingIds = model.settings.map(setting => setting.id)
  if (new Set(operationIds).size !== operationIds.length)
    errors.push(`${model.id}: duplicate operation IDs`)
  if (new Set(slotIds).size !== slotIds.length)
    errors.push(`${model.id}: duplicate input slot IDs`)
  if (new Set(settingIds).size !== settingIds.length)
    errors.push(`${model.id}: duplicate setting IDs`)
  if (!operationIds.includes(model.defaultOperationId))
    errors.push(`${model.id}: default operation does not exist`)

  for (const setting of model.settings) {
    if (setting.kind === 'enum' && !setting.options.some(option => option.value === setting.default))
      errors.push(`${model.id}/${setting.id}: enum default is not an option`)
    if (setting.kind === 'number' && (setting.default < setting.min || setting.default > setting.max))
      errors.push(`${model.id}/${setting.id}: number default is outside its bounds`)
    if (setting.kind === 'string' && setting.default.length > setting.maxLength)
      errors.push(`${model.id}/${setting.id}: string default exceeds maxLength`)
  }

  for (const operation of model.operations) {
    const prefix = `${model.id}/${operation.id}`
    if (operation.output.mediaType !== model.mediaType)
      errors.push(`${prefix}: output media type does not match the model`)
    if (operation.inputSlotIds.some(id => !slotIds.includes(id)))
      errors.push(`${prefix}: operation names an unknown input slot`)
    if (operation.settingIds.some(id => !settingIds.includes(id)))
      errors.push(`${prefix}: operation names an unknown setting`)
    if (operation.referenceLimit.slotIds.some(id => !slotIds.includes(id)))
      errors.push(`${prefix}: reference limit names an unknown input slot`)
    const bindings = model.bindings.filter(binding => binding.operationId === operation.id)
    if (model.status === 'active' && bindings.length === 0)
      errors.push(`${prefix}: active operation has no provider binding`)
    const priorities = bindings.map(binding => binding.priority)
    if (new Set(priorities).size !== priorities.length)
      errors.push(`${prefix}: provider binding priorities conflict`)
  }
  for (const binding of model.bindings) {
    if (!operationIds.includes(binding.operationId)) {
      errors.push(`${model.id}/${binding.operationId}: binding does not resolve to an operation`)
      continue
    }
    errors.push(...validateProviderBinding(model, binding))
    if (binding.executionRuntimes.includes('browser')) {
      errors.push(
        ...browserBindingIncompatibilities(binding).map(reason =>
          `${model.id}/${binding.operationId}: browser runtime — ${reason}`,
        ),
      )
    }
  }
  return errors
}

/**
 * Validates catalog-wide uniqueness, defaults, capabilities, and bindings.
 *
 * @param catalog - Structurally parsed catalog document.
 * @returns Stable diagnostic strings; an empty array means the catalog is valid.
 */
export function validateModelCatalog(catalog: ModelCatalog): string[] {
  const errors: string[] = []
  const ids = catalog.models.map(model => model.id)
  if (new Set(ids).size !== ids.length)
    errors.push('duplicate model IDs')
  for (const model of catalog.models)
    errors.push(...validateModel(model))

  for (const [mediaType, modelId] of Object.entries(catalog.defaults)) {
    const model = catalog.models.find(candidate => candidate.id === modelId)
    if (!model || model.status !== 'active' || model.mediaType !== mediaType)
      errors.push(`${mediaType}: default must resolve to an active matching model`)
  }
  return errors
}
