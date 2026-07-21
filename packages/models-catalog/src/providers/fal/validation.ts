/** Compatibility validation between fal queue bindings and catalog operations. */

import type { CatalogModelRecord } from '../../schema.js'
import type {
  CatalogFalInputMapping,
  CatalogFalParamValue,
  CatalogFalProviderBinding,
} from './contracts.js'

import { FAL_QUEUE_ADAPTER_VERSION } from './contracts.js'

function sameSortedValues(left: readonly string[], right: readonly string[]) {
  return JSON.stringify([...left].toSorted())
    === JSON.stringify([...right].toSorted())
}

function slotAcceptsMedia(
  model: CatalogModelRecord,
  targetSlotId: string,
  mediaType: CatalogFalInputMapping['mediaType'],
) {
  const slot = model.inputSlots.find(candidate => candidate.id === targetSlotId)
  const expectedValueType = mediaType === 'image'
    ? 'ImageSet'
    : mediaType === 'video'
      ? 'VideoSet'
      : 'AudioSet'
  return slot?.accepts.includes(expectedValueType) ?? false
}

function operationRequiresSlot(
  operation: CatalogModelRecord['operations'][number],
  targetSlotId: string,
) {
  const contract = operation.inputs[targetSlotId]
  return contract !== undefined
    && 'required' in contract
    && contract.required === true
}

function settingAcceptsValue(
  setting: CatalogModelRecord['settings'][number] | undefined,
  value: CatalogFalParamValue,
) {
  if (!setting)
    return false
  if (setting.kind === 'boolean')
    return typeof value === 'boolean'
  if (setting.kind === 'number') {
    return typeof value === 'number'
      && value >= setting.min
      && value <= setting.max
  }
  if (setting.kind === 'string')
    return typeof value === 'string' && value.length <= setting.maxLength
  return typeof value === 'string'
    && setting.options.some(option => option.value === value)
}

/** Validates fal queue protocol policy against one catalog operation. */
export function validateFalBindingCompatibility(
  model: CatalogModelRecord,
  binding: CatalogFalProviderBinding,
): string[] {
  const operation = model.operations.find(item => item.id === binding.operationId)
  const prefix = `${model.id}/${binding.operationId}`
  if (!operation)
    return [`${prefix}: binding does not resolve to an operation`]

  const errors: string[] = []
  const profile = binding.requestProfile
  const expectedKind = model.mediaType === 'text'
    ? 'chat'
    : model.mediaType === 'audio'
      ? 'speech'
      : model.mediaType
  if (profile.kind !== expectedKind)
    errors.push(`${prefix}: request profile media does not match the model`)

  if (binding.adapterVersion !== FAL_QUEUE_ADAPTER_VERSION)
    errors.push(`${prefix}: adapter version is incompatible`)

  if (!sameSortedValues(profile.settingIds, operation.settingIds))
    errors.push(`${prefix}: request profile settings do not match the operation`)

  const outputCountSettingId = profile.kind === 'image'
    && profile.requestedCountField !== null
    ? operation.output.count.settingId
    : undefined
  const mappedSettingIds = [
    ...profile.params.flatMap(param => [
      param.settingId,
      ...(param.sendWhen ? [param.sendWhen.settingId] : []),
    ]),
    ...profile.combinedParams.flatMap(param => param.settingIds),
    ...(outputCountSettingId ? [outputCountSettingId] : []),
  ]
  if (!sameSortedValues(mappedSettingIds, profile.settingIds))
    errors.push(`${prefix}: every request profile setting must map exactly once`)
  if (new Set(mappedSettingIds).size !== mappedSettingIds.length)
    errors.push(`${prefix}: request profile maps a setting more than once`)
  for (const param of profile.params) {
    if (!profile.settingIds.includes(param.settingId))
      errors.push(`${prefix}: param maps unknown setting ${param.settingId}`)
    const setting = model.settings.find(candidate => candidate.id === param.settingId)
    if (param.numberMultiplier !== undefined && setting?.kind !== 'number') {
      errors.push(`${prefix}: number multipliers require a number setting`)
    }
    if (param.valueMap) {
      if (setting?.kind !== 'enum') {
        errors.push(`${prefix}: value maps require an enum setting`)
      }
      else if (!sameSortedValues(
        Object.keys(param.valueMap),
        setting.options.map(option => option.value),
      )) {
        errors.push(
          `${prefix}: value map must cover exactly every ${param.settingId} option`,
        )
      }
    }
    if (param.sendWhen) {
      const controllingSetting = model.settings.find(
        candidate => candidate.id === param.sendWhen?.settingId,
      )
      if (!profile.settingIds.includes(param.sendWhen.settingId)) {
        errors.push(
          `${prefix}: sendWhen maps unknown setting ${param.sendWhen.settingId}`,
        )
      }
      else if (!settingAcceptsValue(controllingSetting, param.sendWhen.equals)) {
        errors.push(`${prefix}: sendWhen value is invalid for its setting`)
      }
    }
  }
  for (const combinedParam of profile.combinedParams) {
    const [firstSettingId, secondSettingId] = combinedParam.settingIds
    const firstSetting = model.settings.find(setting => setting.id === firstSettingId)
    const secondSetting = model.settings.find(setting => setting.id === secondSettingId)
    if (
      !profile.settingIds.includes(firstSettingId)
      || !profile.settingIds.includes(secondSettingId)
    ) {
      errors.push(`${prefix}: combined param maps an unknown setting`)
      continue
    }
    if (firstSetting?.kind !== 'enum' || secondSetting?.kind !== 'enum') {
      errors.push(`${prefix}: combined params require two enum settings`)
      continue
    }
    const firstValues = firstSetting.options.map(option => option.value)
    if (!sameSortedValues(Object.keys(combinedParam.valueMap), firstValues)) {
      errors.push(
        `${prefix}: combined param must map every ${firstSettingId} option`,
      )
    }
    const secondValues = secondSetting.options.map(option => option.value)
    for (const firstValue of firstValues) {
      const nestedMap = combinedParam.valueMap[firstValue]
      if (!nestedMap || !sameSortedValues(Object.keys(nestedMap), secondValues)) {
        errors.push(
          `${prefix}: combined param must map every ${secondSettingId} option for ${firstValue}`,
        )
      }
    }
  }

  if (profile.maxInputItems !== operation.referenceLimit.maxItems)
    errors.push(`${prefix}: request profile reference limit does not match the operation`)
  const mappedSlotIds = profile.inputMappings.map(mapping => mapping.targetSlotId)
  if (!sameSortedValues(mappedSlotIds, operation.referenceLimit.slotIds)) {
    errors.push(
      `${prefix}: every operation reference slot must map to one exact fal field`,
    )
  }
  if (new Set(mappedSlotIds).size !== mappedSlotIds.length)
    errors.push(`${prefix}: request profile maps a target slot more than once`)
  const mappedFields = profile.inputMappings.flatMap(mapping => [
    mapping.field,
    ...(mapping.alternativeFields ?? []).map(field => field.field),
  ])
  if (new Set(mappedFields).size !== mappedFields.length)
    errors.push(`${prefix}: request profile maps a fal input field more than once`)
  const maximumMappedItems = profile.inputMappings.reduce(
    (count, mapping) => count + mapping.maxItems,
    0,
  )
  if (maximumMappedItems < profile.maxInputItems)
    errors.push(`${prefix}: fal input fields cannot satisfy the combined item limit`)
  for (const mapping of profile.inputMappings) {
    const slot = model.inputSlots.find(
      candidate => candidate.id === mapping.targetSlotId,
    )
    const mediaTypes = [
      mapping.mediaType,
      ...(mapping.alternativeFields ?? []).map(field => field.mediaType),
    ]
    for (const mediaType of mediaTypes) {
      if (!slotAcceptsMedia(model, mapping.targetSlotId, mediaType)) {
        errors.push(
          `${prefix}: ${mapping.targetSlotId} does not accept ${mediaType} media`,
        )
      }
    }
    const expectedMaximum = slot
      ? Math.min(slot.maxItems, operation.referenceLimit.maxItems)
      : 0
    if (mapping.maxItems !== expectedMaximum) {
      errors.push(
        `${prefix}: ${mapping.targetSlotId} does not match its accepted item limit`,
      )
    }
    const expectedMinimum = operationRequiresSlot(operation, mapping.targetSlotId)
      ? 1
      : 0
    if (mapping.minItems !== expectedMinimum) {
      errors.push(
        `${prefix}: ${mapping.targetSlotId} does not match its required cardinality`,
      )
    }
    if (mapping.cardinality === 'single' && mapping.maxItems !== 1) {
      errors.push(
        `${prefix}: single fal input field ${mapping.field} must accept exactly one item`,
      )
    }
  }
  const occupiedFields = [
    profile.promptField,
    profile.kind === 'image' ? profile.requestedCountField : null,
    ...profile.params.map(param => param.field),
    ...profile.combinedParams.map(param => param.field),
    ...mappedFields,
    ...Object.keys(profile.staticParams),
  ].filter((field): field is string => field !== null)
  if (new Set(occupiedFields).size !== occupiedFields.length)
    errors.push(`${prefix}: fal request fields must have one authoritative source`)
  const hasTextInput = operation.inputSlotIds.some((slotId) => {
    const slot = model.inputSlots.find(candidate => candidate.id === slotId)
    return slot?.accepts.includes('Text') ?? false
  })
  if ((profile.promptField !== null) !== hasTextInput) {
    errors.push(`${prefix}: prompt field does not match the operation text input`)
  }
  const supportsRequestedCount = profile.kind === 'image'
    && profile.requestedCountField !== null
  if (operation.output.count.max > 1 && !supportsRequestedCount)
    errors.push(`${prefix}: request profile cannot satisfy the output count range`)
  if (supportsRequestedCount && !operation.output.count.settingId) {
    errors.push(`${prefix}: requested output count has no catalog setting source`)
  }

  const lifecycle = binding.lifecycle
  const lifecycleCompatible = lifecycle.submission === 'asynchronous'
    && lifecycle.cancellation === 'best-effort'
    && lifecycle.completions[0] === 'poll'
    && lifecycle.completions.length === 1
    && lifecycle.deliveries[0] === 'stream'
    && lifecycle.deliveries.length === 1
  if (!lifecycleCompatible)
    errors.push(`${prefix}: lifecycle is incompatible with the fal queue protocol`)
  return errors
}
