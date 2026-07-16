import type { GenerationSettingDefinition } from '../registry/types.js'

import { VIDEO_ASPECT_RATIOS } from './common.js'

function enumSetting(
  id: 'aspectRatio' | 'durationSeconds' | 'resolution',
  values: readonly string[],
  defaultValue = values[0]!,
): GenerationSettingDefinition {
  const labelKey = id === 'durationSeconds'
    ? 'flows.settings.duration'
    : `flows.settings.${id}`
  return {
    default: defaultValue,
    id,
    kind: 'enum',
    labelKey,
    options: values.map(value => ({
      labelKey: id === 'durationSeconds'
        ? `flows.settings.durations.seconds${value}`
        : id === 'resolution'
          ? `flows.settings.resolutions.${value.toLowerCase()}`
          : `flows.settings.aspectRatios.${value === '16:9' ? 'landscape' : 'portrait'}`,
      value,
    })),
  }
}

export function videoSettings(input: {
  audio?: boolean
  defaultDuration?: string
  durations: readonly string[]
  resolutions: readonly string[]
}) {
  return [
    enumSetting(
      'aspectRatio',
      VIDEO_ASPECT_RATIOS.map(option => option.value),
      '16:9',
    ),
    enumSetting(
      'durationSeconds',
      input.durations,
      input.defaultDuration ?? input.durations[0],
    ),
    enumSetting('resolution', input.resolutions, input.resolutions[0]),
    ...(input.audio
      ? [{
          default: true,
          id: 'generateAudio',
          kind: 'boolean' as const,
          labelKey: 'flows.settings.generateAudio',
        }]
      : []),
  ] as const satisfies readonly GenerationSettingDefinition[]
}
