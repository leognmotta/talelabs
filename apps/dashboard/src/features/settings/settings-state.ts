/** URL-backed state for the active Settings destination. */

import { parseAsStringEnum, useQueryState } from 'nuqs'

/** Settings destinations supported by the account dialog. */
export const settingsTabs = [
  'general',
  'organization',
  'profile',
  'security',
  'team',
  'secureStore',
] as const

/** Stable URL value identifying one Settings destination. */
export type SettingsTab = typeof settingsTabs[number]

/** nuqs parser that rejects unsupported Settings destinations. */
export const settingsTabParser = parseAsStringEnum<SettingsTab>([
  ...settingsTabs,
])

/** Returns URL-backed Settings state for dialog navigation. */
export function useSettingsTabState() {
  return useQueryState('settings', settingsTabParser)
}
