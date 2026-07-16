import type {
  GenerationModelDefinition,
  GenerationSettingValue,
} from '../registry/types.js'

import { isGenerationSettingValueValid } from '../registry/index.js'
import { normalizeImageGenerationInputSlotId } from './image-input-aliases.js'
import { imageInputCount } from './image-input-counts.js'
import { applyGenerationSettingRequirements } from './setting-requirements.js'

export function resolveImageGenerationOperation(
  model: GenerationModelDefinition,
  itemCounts: Readonly<Record<string, number>>,
) {
  if (model.mediaType !== 'image')
    return undefined
  const hasReferences = imageInputCount(itemCounts, 'imageReferences') > 0
  if (hasReferences) {
    return model.operations.find(
      operation => operation.id === 'imageToImage'
        && operation.inputSlotIds.some(
          slotId => normalizeImageGenerationInputSlotId(slotId)
            === 'imageReferences',
        ),
    )
  }
  return model.operations.find(
    operation => operation.id === model.defaultOperationId,
  ) ?? model.operations.find(operation => operation.id === 'textToImage')
}

export function normalizeImageGenerationSettings(input: {
  model: GenerationModelDefinition
  operationId: string
  settings: Readonly<Record<string, GenerationSettingValue>>
  connectedSlotIds: ReadonlySet<string>
}) {
  const operation = input.model.operations.find(
    item => item.id === input.operationId,
  )
  const activeSettingIds = new Set(operation?.settingIds ?? [])
  const normalized: Record<string, GenerationSettingValue> = {}
  for (const setting of input.model.settings) {
    if (!activeSettingIds.has(setting.id))
      continue
    const saved = input.settings[setting.id]
    normalized[setting.id]
      = saved !== undefined && isGenerationSettingValueValid(setting, saved)
        ? saved
        : setting.default
  }
  return applyGenerationSettingRequirements({
    connectedSlotIds: input.connectedSlotIds,
    model: input.model,
    operationId: input.operationId,
    settings: normalized,
  })
}
