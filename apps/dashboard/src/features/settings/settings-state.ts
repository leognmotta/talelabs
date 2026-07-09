export const settingsTabs = [
  'general',
  'profile',
  'security',
  'team',
  'billing',
] as const

export type SettingsTab = typeof settingsTabs[number]
