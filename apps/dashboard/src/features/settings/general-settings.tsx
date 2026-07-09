import type { ThemePreference } from '../../shared/lib/theme'
import type { LanguagePreference } from './settings-utils'

import { Button } from '@talelabs/ui/components/button'
import {
  NativeSelect,
  NativeSelectOption,
} from '@talelabs/ui/components/native-select'
import { Separator } from '@talelabs/ui/components/separator'
import { themeOptions } from './settings-options'
import { SettingsRow } from './settings-row'

export function GeneralSettings({
  language,
  onLanguageChange,
  onOpenCookiePreferences,
  onThemeChange,
  theme,
}: {
  language: LanguagePreference
  onLanguageChange: (language: LanguagePreference) => void
  onOpenCookiePreferences: () => void
  onThemeChange: (theme: ThemePreference) => void
  theme: ThemePreference
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pb-4">
        <h2 className="text-lg font-semibold">General</h2>
      </header>
      <Separator />
      <SettingsRow label="Theme">
        <div className="
          grid w-full grid-cols-3 gap-2
          sm:w-auto
        "
        >
          {themeOptions.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.value}
                type="button"
                variant={theme === item.value ? 'secondary' : 'ghost'}
                className="justify-center"
                onClick={() => onThemeChange(item.value)}
              >
                <Icon />
                <span>{item.label}</span>
              </Button>
            )
          })}
        </div>
      </SettingsRow>
      <Separator />
      <SettingsRow label="Language">
        <NativeSelect
          aria-label="Language"
          value={language}
          className="
            w-full
            sm:w-44
          "
          onChange={(event) => {
            const nextLanguage = event.target.value
            if (
              nextLanguage === 'auto'
              || nextLanguage === 'en'
              || nextLanguage === 'pt-BR'
            ) {
              onLanguageChange(nextLanguage)
            }
          }}
        >
          <NativeSelectOption value="auto">Auto-detect</NativeSelectOption>
          <NativeSelectOption value="en">English</NativeSelectOption>
          <NativeSelectOption value="pt-BR">Portuguese</NativeSelectOption>
        </NativeSelect>
      </SettingsRow>
      <Separator />
      <SettingsRow
        label="Cookie preferences"
        description="Manage analytics and marketing cookie choices."
      >
        <Button
          type="button"
          variant="outline"
          onClick={onOpenCookiePreferences}
        >
          Manage cookies
        </Button>
      </SettingsRow>
    </div>
  )
}
