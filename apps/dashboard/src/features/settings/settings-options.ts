import type { ThemePreference } from '../../shared/lib/theme'
import type { SettingsTab } from './settings-state'

import {
  IconCreditCard,
  IconDeviceDesktop,
  IconMoon,
  IconSettings,
  IconShieldLock,
  IconSun,
  IconUserCircle,
  IconUsersGroup,
} from '@tabler/icons-react'

export const settingsNavigation: {
  icon: typeof IconSettings
  label: string
  value: SettingsTab
}[] = [
  { icon: IconSettings, label: 'General', value: 'general' },
  { icon: IconUserCircle, label: 'Profile', value: 'profile' },
  { icon: IconShieldLock, label: 'Security', value: 'security' },
  { icon: IconUsersGroup, label: 'Team', value: 'team' },
  { icon: IconCreditCard, label: 'Billing', value: 'billing' },
]

export const themeOptions: {
  icon: typeof IconSun
  label: string
  value: ThemePreference
}[] = [
  { icon: IconSun, label: 'Light', value: 'light' },
  { icon: IconMoon, label: 'Dark', value: 'dark' },
  { icon: IconDeviceDesktop, label: 'System', value: 'system' },
]
