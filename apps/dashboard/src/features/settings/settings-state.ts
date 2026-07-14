import { parseAsStringEnum, useQueryState } from 'nuqs'

export const settingsTabs = [
  'general',
  'organization',
  'profile',
  'security',
  'team',
] as const

export type SettingsTab = typeof settingsTabs[number]

export const settingsTabParser = parseAsStringEnum<SettingsTab>([
  ...settingsTabs,
])

export function useSettingsTabState() {
  return useQueryState('settings', settingsTabParser)
}
