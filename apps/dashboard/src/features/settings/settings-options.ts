import type { ThemePreference } from '../../shared/lib/theme'
import type { SettingsTab } from './settings-state'

import {
  IconBuilding,
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
  labelKey: `settings.${SettingsTab}`
  value: SettingsTab
}[] = [
  { icon: IconSettings, labelKey: 'settings.general', value: 'general' },
  { icon: IconBuilding, labelKey: 'settings.organization', value: 'organization' },
  { icon: IconUserCircle, labelKey: 'settings.profile', value: 'profile' },
  { icon: IconShieldLock, labelKey: 'settings.security', value: 'security' },
  { icon: IconUsersGroup, labelKey: 'settings.team', value: 'team' },
]

export const themeOptions: {
  icon: typeof IconSun
  labelKey: 'settings.dark' | 'settings.light' | 'settings.system'
  value: ThemePreference
}[] = [
  { icon: IconSun, labelKey: 'settings.light', value: 'light' },
  { icon: IconMoon, labelKey: 'settings.dark', value: 'dark' },
  { icon: IconDeviceDesktop, labelKey: 'settings.system', value: 'system' },
]
