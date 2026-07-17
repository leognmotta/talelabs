/** Static Settings navigation and appearance option definitions. */

import type { ThemePreference } from '../../shared/lib/theme'
import type { SettingsTab } from './settings-state'

import {
  IconBuilding,
  IconDeviceDesktop,
  IconKey,
  IconMoon,
  IconSettings,
  IconShieldLock,
  IconSun,
  IconUserCircle,
  IconUsersGroup,
} from '@tabler/icons-react'

/** Grouped destinations rendered by the Settings navigation. */
export const settingsNavigationGroups: {
  id: 'account' | 'providers'
  items: {
    icon: typeof IconSettings
    labelKey: `settings.${SettingsTab}`
    value: SettingsTab
  }[]
  labelKey?: 'settings.providers'
}[] = [
  {
    id: 'account',
    items: [
      { icon: IconSettings, labelKey: 'settings.general', value: 'general' },
      { icon: IconBuilding, labelKey: 'settings.organization', value: 'organization' },
      { icon: IconUserCircle, labelKey: 'settings.profile', value: 'profile' },
      { icon: IconShieldLock, labelKey: 'settings.security', value: 'security' },
      { icon: IconUsersGroup, labelKey: 'settings.team', value: 'team' },
    ],
  },
  {
    id: 'providers',
    items: [
      { icon: IconKey, labelKey: 'settings.secureStore', value: 'secureStore' },
    ],
    labelKey: 'settings.providers',
  },
]

/** Theme choices supported by the General Settings surface. */
export const themeOptions: {
  icon: typeof IconSun
  labelKey: 'settings.dark' | 'settings.light' | 'settings.system'
  value: ThemePreference
}[] = [
  { icon: IconSun, labelKey: 'settings.light', value: 'light' },
  { icon: IconMoon, labelKey: 'settings.dark', value: 'dark' },
  { icon: IconDeviceDesktop, labelKey: 'settings.system', value: 'system' },
]
