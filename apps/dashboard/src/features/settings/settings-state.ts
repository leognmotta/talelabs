export const settingsTabs = [
  'general',
  'organization',
  'profile',
  'security',
  'team',
  'billing',
] as const

export type SettingsTab = typeof settingsTabs[number]
