import type { HardenedGenerationModelDefinition } from './types.js'

const ASPECT_RATIO_LABEL_KEYS: Readonly<Record<string, string>> = {
  '1:1': 'flows.settings.aspectRatios.square',
  '2:3': 'flows.settings.aspectRatios.portraitPhoto',
  '3:2': 'flows.settings.aspectRatios.photo',
  '3:4': 'flows.settings.aspectRatios.portraitPhoto',
  '4:3': 'flows.settings.aspectRatios.photo',
  '9:16': 'flows.settings.aspectRatios.portrait',
  '16:9': 'flows.settings.aspectRatios.landscape',
} as const

type ReviewedEnumSettingId = 'aspectRatio' | 'durationSeconds' | 'resolution'

export function withReviewedSettingOptions(
  model: HardenedGenerationModelDefinition,
  valuesBySetting: Partial<
    Readonly<Record<ReviewedEnumSettingId, readonly string[]>>
  >,
): HardenedGenerationModelDefinition {
  return {
    ...model,
    settings: model.settings.map((setting) => {
      const values = valuesBySetting[setting.id as ReviewedEnumSettingId]
      if (setting.kind !== 'enum' || !values)
        return setting
      return {
        ...setting,
        options: values.map(value => ({
          labelKey: setting.id === 'durationSeconds'
            ? `flows.settings.durations.seconds${value}`
            : setting.id === 'resolution'
              ? `flows.settings.resolutions.${value.toLowerCase()}`
              : ASPECT_RATIO_LABEL_KEYS[value]
                ?? 'flows.settings.aspectRatio',
          value,
        })),
      }
    }),
  }
}

export function withReviewedImageReferenceOperation(
  model: HardenedGenerationModelDefinition,
  template: HardenedGenerationModelDefinition,
  maxReferences: number,
): HardenedGenerationModelDefinition {
  const referenceSlot = template.inputSlots.find(
    slot => slot.id === 'imageReferences',
  )
  const operationTemplate = template.operations.find(
    operation => operation.id === 'imageToImage',
  )
  const textOperation = model.operations.find(
    operation => operation.id === 'textToImage',
  )
  if (!referenceSlot || !operationTemplate || !textOperation)
    throw new Error('generation_image_reference_template_invalid')
  return {
    ...model,
    inputSlots: [
      ...model.inputSlots,
      {
        ...referenceSlot,
        maxConnections: maxReferences,
        maxItems: maxReferences,
      },
    ],
    operations: [
      ...model.operations,
      {
        ...operationTemplate,
        nodeType: textOperation.nodeType,
        output: textOperation.output,
        referenceLimit: {
          maxItems: maxReferences,
          slotIds: ['imageReferences'],
        },
        settingIds: textOperation.settingIds,
      },
    ],
  }
}
