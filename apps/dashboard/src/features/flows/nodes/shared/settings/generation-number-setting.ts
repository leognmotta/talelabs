/** Numeric generation-setting clamping, step alignment, and precision rules. */

import type { GenerationSettingDefinition } from '@talelabs/flows'

type NumberSetting = Extract<GenerationSettingDefinition, { kind: 'number' }>

function decimalPlaces(value: number) {
  const [coefficient, exponentText] = value.toString().toLowerCase().split('e')
  const exponent = Number(exponentText ?? 0)
  const fractionLength = coefficient?.split('.')[1]?.length ?? 0
  return Math.max(0, fractionLength - exponent)
}

/** Clamps a number to catalog bounds and aligns it to the declared step. */
export function normalizeNumberSetting(value: number, setting: NumberSetting) {
  const clamped = Math.min(setting.max, Math.max(setting.min, value))
  const steps = Math.round((clamped - setting.min) / setting.step)
  const aligned = setting.min + steps * setting.step
  const precision = Math.min(
    12,
    Math.max(
      decimalPlaces(setting.min),
      decimalPlaces(setting.max),
      decimalPlaces(setting.step),
    ),
  )
  return Number(aligned.toFixed(precision))
}
