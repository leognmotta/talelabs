export const settingsTabs = [
  'general',
  'organization',
  'profile',
  'security',
  'team',
] as const

export type SettingsTab = typeof settingsTabs[number]
