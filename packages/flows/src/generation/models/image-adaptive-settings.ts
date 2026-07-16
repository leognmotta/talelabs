import type { GenerationSettingDefinition } from '../registry/types.js'

export function imageEnumSetting(
  id: 'aspectRatio' | 'resolution',
  values: readonly string[],
  defaultValue = values[0]!,
): GenerationSettingDefinition {
  return {
    default: defaultValue,
    id,
    kind: 'enum',
    labelKey: `flows.settings.${id}`,
    options: values.map(value => ({
      labelKey:
        id === 'resolution'
          ? `flows.settings.resolutions.${value.toLowerCase()}`
          : value === '1:1'
            ? 'flows.settings.aspectRatios.square'
            : 'flows.settings.aspectRatio',
      value,
    })),
  }
}

export function imageOutputCountSetting(
  max: number,
): GenerationSettingDefinition {
  return {
    default: 1,
    id: 'outputCount',
    kind: 'number',
    labelKey: 'flows.settings.outputCount',
    max,
    min: 1,
    step: 1,
  }
}
