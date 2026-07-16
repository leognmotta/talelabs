import type {
  GenerationModelDefinition,
  GenerationSettingValue,
} from '../types.js'

import { isGenerationSettingValueValid } from '../../resolution/setting-validation.js'
import { GENERATION_MODEL_REGISTRY } from '../contracts.js'
import {
  generationConditionKey,
  validateGenerationCondition,
} from './conditions.js'

export function validateGenerationRegistry(
  registry: Readonly<
    Record<string, GenerationModelDefinition>
  > = GENERATION_MODEL_REGISTRY,
  options: { requireHardened?: boolean } = {},
) {
  const errors: string[] = []

  for (const [key, model] of Object.entries(registry)) {
    const hardened
      = options.requireHardened
        || model.capabilitySchemaVersion === 2
        || model.capabilitySchemaVersion === 3
    if (key !== model.id)
      errors.push(`${key}: model id must match its registry key`)
    if (!model.id.startsWith('talelabs/'))
      errors.push(`${key}: product model ids must use the talelabs namespace`)
    if (!model.operations.length)
      errors.push(`${key}: at least one operation is required`)
    if (options.requireHardened && model.capabilitySchemaVersion !== 3) {
      errors.push(
        `${key}: current contracts must use capability schema version 3`,
      )
    }
    if (options.requireHardened && !model.enabled) {
      errors.push(
        `${key}: unavailable models must not exist in the current catalog`,
      )
    }
    if (hardened && model.provider) {
      errors.push(
        `${key}: hardened public contracts must not expose a provider`,
      )
    }
    if (model.mediaType === 'text' && !model.llm)
      errors.push(`${key}: text-output models require LLM capabilities`)
    if (model.mediaType !== 'text' && model.llm) {
      errors.push(
        `${key}: only text-output models may declare LLM capabilities`,
      )
    }

    const responseLength = model.settings.find(
      setting => setting.id === 'responseLength',
    )
    const reasoningMode = model.settings.find(
      setting => setting.id === 'reasoningMode',
    )
    if (model.mediaType === 'text') {
      const expectedResponseLengths = ['auto', 'short', 'medium', 'long']
      if (
        responseLength?.kind !== 'enum'
        || JSON.stringify(responseLength.options.map(option => option.value))
        !== JSON.stringify(expectedResponseLengths)
      ) {
        errors.push(`${key}: LLM response-length options are invalid`)
      }
      const reasoning = model.llm?.reasoning
      if (!reasoning && reasoningMode)
        errors.push(`${key}: unsupported reasoning must not expose a setting`)
      if (reasoning) {
        const optionValues
          = reasoningMode?.kind === 'enum'
            ? reasoningMode.options.map(option => option.value)
            : []
        if (
          reasoningMode?.kind !== 'enum'
          || reasoningMode.default !== reasoning.default
          || JSON.stringify(optionValues) !== JSON.stringify(reasoning.options)
        ) {
          errors.push(`${key}: reasoning setting must match its capability`)
        }
        if (
          !reasoning.options.length
          || new Set(reasoning.options).size !== reasoning.options.length
          || !reasoning.options.includes(reasoning.default)
        ) {
          errors.push(`${key}: reasoning options and default are invalid`)
        }
        if (reasoning.mandatory === reasoning.options.includes('off')) {
          errors.push(
            `${key}: mandatory reasoning controls whether Off is available`,
          )
        }
      }
    }

    const inputIds = model.inputSlots.map(slot => slot.id)
    const settingIds = model.settings.map(setting => setting.id)
    const operationIds = model.operations.map(operation => operation.id)
    const settingsById = new Map(
      model.settings.map(setting => [setting.id, setting]),
    )
    if (new Set(inputIds).size !== inputIds.length)
      errors.push(`${key}: input slot ids must be unique`)
    if (new Set(settingIds).size !== settingIds.length)
      errors.push(`${key}: setting ids must be unique`)
    if (new Set(operationIds).size !== operationIds.length)
      errors.push(`${key}: operation ids must be unique`)
    const constraintIds = model.constraints.map(constraint => constraint.id)
    if (new Set(constraintIds).size !== constraintIds.length)
      errors.push(`${key}: constraint ids must be unique`)
    if (!operationIds.includes(model.defaultOperationId))
      errors.push(`${key}: default operation must exist`)

    for (const slot of model.inputSlots) {
      if (
        !Number.isInteger(slot.maxConnections)
        || !Number.isInteger(slot.maxItems)
        || slot.maxConnections < 1
        || slot.maxItems < 1
      ) {
        errors.push(`${key}.${slot.id}: maxima must be positive integers`)
      }
      if (
        !Number.isInteger(slot.minConnections)
        || slot.minConnections < 0
        || slot.minConnections > slot.maxConnections
      ) {
        errors.push(`${key}.${slot.id}: connection cardinality is invalid`)
      }
      if (
        !slot.accepts.length
        || new Set(slot.accepts).size !== slot.accepts.length
      ) {
        errors.push(
          `${key}.${slot.id}: accepted value types must be non-empty and unique`,
        )
      }
      if (slot.referenceProfile) {
        const profile = slot.referenceProfile
        if (
          !profile.purposes.length
          || new Set(profile.purposes).size !== profile.purposes.length
        ) {
          errors.push(
            `${key}.${slot.id}: reference purposes must be non-empty and unique`,
          )
        }
        if (
          profile.recommendedMaxItems !== undefined
          && (!Number.isInteger(profile.recommendedMaxItems)
            || profile.recommendedMaxItems < 1
            || profile.recommendedMaxItems > slot.maxItems)
        ) {
          errors.push(`${key}.${slot.id}: recommended maximum is invalid`)
        }
        if (!slot.acceptedMedia) {
          errors.push(
            `${key}.${slot.id}: accepted media constraints are required`,
          )
        }
      }
      if (slot.acceptedMedia) {
        const media = slot.acceptedMedia
        if (
          !media.mimeTypes.length
          || new Set(media.mimeTypes).size !== media.mimeTypes.length
        ) {
          errors.push(
            `${key}.${slot.id}: accepted MIME types must be non-empty and unique`,
          )
        }
        if (
          media.maxBytes !== undefined
          && (!Number.isInteger(media.maxBytes) || media.maxBytes < 1)
        ) {
          errors.push(
            `${key}.${slot.id}: accepted media byte limit is invalid`,
          )
        }
        if (
          media.durationSeconds
          && (!Number.isFinite(media.durationSeconds.min)
            || !Number.isFinite(media.durationSeconds.max)
            || media.durationSeconds.min < 0
            || media.durationSeconds.min > media.durationSeconds.max)
        ) {
          errors.push(`${key}.${slot.id}: accepted media duration is invalid`)
        }
        if (
          media.framesPerSecond
          && (!media.framesPerSecond.length
            || new Set(media.framesPerSecond).size
            !== media.framesPerSecond.length
            || media.framesPerSecond.some(
              value => !Number.isFinite(value) || value <= 0,
            ))
        ) {
          errors.push(`${key}.${slot.id}: accepted frame rates are invalid`)
        }
        for (const [name, values] of [
          ['aspect ratios', media.aspectRatios],
          ['resolutions', media.resolutions],
        ] as const) {
          if (
            values
            && (!values.length || new Set(values).size !== values.length)
          ) {
            errors.push(
              `${key}.${slot.id}: accepted media ${name} must be non-empty and unique`,
            )
          }
        }
      }
    }

    for (const operation of model.operations) {
      if (model.capabilitySchemaVersion === 3 && !operation.nodeType) {
        errors.push(
          `${key}.${operation.id}: capability-v3 operations require a node type`,
        )
      }
      if (
        new Set(operation.inputSlotIds).size !== operation.inputSlotIds.length
      )
        errors.push(`${key}.${operation.id}: input slot ids must be unique`)
      if (new Set(operation.settingIds).size !== operation.settingIds.length)
        errors.push(`${key}.${operation.id}: setting ids must be unique`)
      for (const slotId of operation.inputSlotIds) {
        if (!inputIds.includes(slotId))
          errors.push(`${key}.${operation.id}: unknown input slot ${slotId}`)
      }
      for (const settingId of operation.settingIds) {
        if (!settingIds.includes(settingId))
          errors.push(`${key}.${operation.id}: unknown setting ${settingId}`)
      }
      for (const settingId of operation.requiredSettingIds ?? []) {
        if (!operation.settingIds.includes(settingId)) {
          errors.push(
            `${key}.${operation.id}: required setting ${settingId} must be active`,
          )
        }
      }
      for (const [contractId, contract] of Object.entries(operation.inputs)) {
        const contractModes = [
          Boolean(contract.required),
          Boolean(contract.oneOf),
          Boolean(contract.atLeastOne),
        ].filter(Boolean).length
        if (contractModes > 1) {
          errors.push(
            `${key}.${operation.id}.${contractId}: required, oneOf, and atLeastOne are mutually exclusive`,
          )
        }
        if (contract.atLeastOne) {
          if (contract.atLeastOne.length < 2) {
            errors.push(
              `${key}.${operation.id}.${contractId}: atLeastOne requires at least two slots`,
            )
          }
          if (
            new Set(contract.atLeastOne).size !== contract.atLeastOne.length
          ) {
            errors.push(
              `${key}.${operation.id}.${contractId}: atLeastOne slots must be unique`,
            )
          }
          for (const slotId of contract.atLeastOne) {
            if (!operation.inputSlotIds.includes(slotId)) {
              errors.push(
                `${key}.${operation.id}.${contractId}: inactive atLeastOne slot ${slotId}`,
              )
            }
          }
        }
        else if (contract.oneOf) {
          if (contract.oneOf.length < 2) {
            errors.push(
              `${key}.${operation.id}.${contractId}: oneOf requires at least two slots`,
            )
          }
          if (new Set(contract.oneOf).size !== contract.oneOf.length) {
            errors.push(
              `${key}.${operation.id}.${contractId}: oneOf slots must be unique`,
            )
          }
          for (const slotId of contract.oneOf) {
            if (!operation.inputSlotIds.includes(slotId)) {
              errors.push(
                `${key}.${operation.id}.${contractId}: inactive oneOf slot ${slotId}`,
              )
            }
          }
        }
        else if (!operation.inputSlotIds.includes(contractId)) {
          errors.push(
            `${key}.${operation.id}: input contract references inactive slot ${contractId}`,
          )
        }
      }

      if (hardened) {
        if (!operation.output || !operation.referenceLimit) {
          errors.push(
            `${key}.${operation.id}: hardened output and reference limits are required`,
          )
          continue
        }
        if (operation.output.mediaType !== model.mediaType) {
          errors.push(
            `${key}.${operation.id}: output media type must match the model`,
          )
        }
        const count = operation.output.count
        if (
          ![count.default, count.min, count.max].every(Number.isInteger)
          || count.min < 1
          || count.default < count.min
          || count.default > count.max
        ) {
          errors.push(`${key}.${operation.id}: output count is invalid`)
        }
        if (count.settingId) {
          const setting = settingsById.get(count.settingId)
          if (
            !setting
            || setting.kind !== 'number'
            || !operation.settingIds.includes(count.settingId)
            || setting.min !== count.min
            || setting.max !== count.max
            || setting.default !== count.default
          ) {
            errors.push(
              `${key}.${operation.id}: output count setting does not match its capability`,
            )
          }
        }
        const limit = operation.referenceLimit
        if (!Number.isInteger(limit.maxItems) || limit.maxItems < 0) {
          errors.push(
            `${key}.${operation.id}: total reference limit is invalid`,
          )
        }
        if (new Set(limit.slotIds).size !== limit.slotIds.length) {
          errors.push(
            `${key}.${operation.id}: reference limit slot ids must be unique`,
          )
        }
        const activeReferenceSlots = model.inputSlots.filter(
          slot =>
            operation.inputSlotIds.includes(slot.id) && slot.referenceProfile,
        )
        const activeReferenceIds = new Set(
          activeReferenceSlots.map(slot => slot.id),
        )
        if (
          limit.slotIds.some(slotId => !activeReferenceIds.has(slotId))
          || activeReferenceSlots.some(slot => !limit.slotIds.includes(slot.id))
        ) {
          errors.push(
            `${key}.${operation.id}: total reference slots must match active reference inputs`,
          )
        }
        const possibleReferences = activeReferenceSlots.reduce(
          (total, slot) => total + slot.maxItems,
          0,
        )
        if (limit.maxItems > possibleReferences) {
          errors.push(
            `${key}.${operation.id}: total reference limit exceeds slot limits`,
          )
        }
        const requiredReferenceIds = new Set(
          Object.entries(operation.inputs)
            .filter(
              ([slotId, requirement]) =>
                requirement.required && activeReferenceIds.has(slotId),
            )
            .map(([slotId]) => slotId),
        )
        const requiredReferenceGroups = Object.values(operation.inputs).filter(
          requirement =>
            (requirement.oneOf?.length
              && requirement.oneOf.every(slotId =>
                activeReferenceIds.has(slotId),
              ))
              || (requirement.atLeastOne?.length
                && requirement.atLeastOne.every(slotId =>
                  activeReferenceIds.has(slotId),
                )),
        ).length
        const minimumReferences
          = requiredReferenceIds.size + requiredReferenceGroups
        if (limit.maxItems < minimumReferences) {
          errors.push(
            `${key}.${operation.id}: total reference limit cannot satisfy required inputs`,
          )
        }
      }
    }

    for (const setting of model.settings) {
      if (
        setting.kind === 'number'
        && (![setting.default, setting.min, setting.max, setting.step].every(
          Number.isFinite,
        )
        || setting.step <= 0
        || setting.min > setting.max
        || !isGenerationSettingValueValid(setting, setting.default))
      ) {
        errors.push(`${key}.${setting.id}: number definition is invalid`)
      }
      if (setting.kind === 'enum') {
        const values = setting.options.map(option => option.value)
        if (
          !values.length
          || new Set(values).size !== values.length
          || !isGenerationSettingValueValid(setting, setting.default)
        ) {
          errors.push(`${key}.${setting.id}: enum definition is invalid`)
        }
      }
      if (
        setting.kind === 'string'
        && (!Number.isInteger(setting.maxLength)
          || setting.maxLength < 1
          || !isGenerationSettingValueValid(setting, setting.default))
      ) {
        errors.push(`${key}.${setting.id}: string definition is invalid`)
      }
      for (const condition of setting.visibleWhen ?? []) {
        errors.push(
          ...validateGenerationCondition({
            condition,
            constraintId: `${setting.id}.visibleWhen`,
            inputIds,
            key,
            operationIds,
            settingsById,
          }),
        )
      }
    }

    for (const constraint of model.constraints) {
      if (
        !constraint.when.length
        || (!constraint.require?.length && !constraint.forbid?.length)
      ) {
        errors.push(
          `${key}.${constraint.id}: constraint conditions are incomplete`,
        )
      }
      for (const condition of [
        ...constraint.when,
        ...(constraint.require ?? []),
        ...(constraint.forbid ?? []),
      ]) {
        errors.push(
          ...validateGenerationCondition({
            condition,
            constraintId: constraint.id,
            inputIds,
            key,
            operationIds,
            settingsById,
          }),
        )
      }
      const requiredKeys = new Set(
        (constraint.require ?? []).map(generationConditionKey),
      )
      if (
        (constraint.forbid ?? []).some(condition =>
          requiredKeys.has(generationConditionKey(condition)),
        )
      ) {
        errors.push(
          `${key}.${constraint.id}: the same condition cannot be required and forbidden`,
        )
      }
      const requiredEquals = new Map<string, GenerationSettingValue>()
      for (const condition of constraint.require ?? []) {
        if (condition.field !== 'setting' || condition.operator !== 'equals')
          continue
        const previous = requiredEquals.get(condition.id)
        if (previous !== undefined && previous !== condition.value) {
          errors.push(
            `${key}.${constraint.id}: conflicting requirements for ${condition.id}`,
          )
        }
        requiredEquals.set(condition.id, condition.value)
      }

      const explicitlyScopedOperations = constraint.when
        .filter(condition => condition.field === 'operation')
        .map(condition => condition.value)
      const applicableOperations = model.operations
        .filter(
          operation =>
            !explicitlyScopedOperations.length
            || explicitlyScopedOperations.includes(operation.id),
        )
        .filter(operation =>
          constraint.when.every((condition) => {
            if (condition.field === 'operation')
              return true
            if (condition.field === 'slot')
              return operation.inputSlotIds.includes(condition.id)
            return operation.settingIds.includes(condition.id)
          }),
        )
      if (!applicableOperations.length) {
        errors.push(
          `${key}.${constraint.id}: constraint cannot apply to any operation`,
        )
      }
      for (const operation of applicableOperations) {
        for (const condition of [
          ...(constraint.require ?? []),
          ...(constraint.forbid ?? []),
        ]) {
          if (
            condition.field === 'slot'
            && !operation.inputSlotIds.includes(condition.id)
          ) {
            errors.push(
              `${key}.${constraint.id}: slot ${condition.id} is inactive for ${operation.id}`,
            )
          }
          if (
            condition.field === 'setting'
            && !operation.settingIds.includes(condition.id)
          ) {
            errors.push(
              `${key}.${constraint.id}: setting ${condition.id} is inactive for ${operation.id}`,
            )
          }
        }
      }
    }
  }

  return errors
}

export function validateHardenedGenerationRegistry(
  registry: Readonly<
    Record<string, GenerationModelDefinition>
  > = GENERATION_MODEL_REGISTRY,
) {
  return validateGenerationRegistry(registry, { requireHardened: true })
}
