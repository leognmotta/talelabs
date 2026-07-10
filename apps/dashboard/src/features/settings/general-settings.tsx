import type { LanguagePreference } from '@talelabs/i18n'
import type { ThemePreference } from '../../shared/lib/theme'

import { isSupportedLocale, localeDefinitions } from '@talelabs/i18n'
import { Button } from '@talelabs/ui/components/button'
import {
  NativeSelect,
  NativeSelectOption,
} from '@talelabs/ui/components/native-select'
import { Separator } from '@talelabs/ui/components/separator'
import { useTranslation } from 'react-i18next'
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
  onLanguageChange: (language: LanguagePreference) => Promise<void>
  onOpenCookiePreferences: () => void
  onThemeChange: (theme: ThemePreference) => void
  theme: ThemePreference
}) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pb-4">
        <h2 className="text-lg font-semibold">{t('settings.general')}</h2>
      </header>
      <Separator />
      <SettingsRow label={t('settings.theme')}>
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
                <span>{t(item.labelKey)}</span>
              </Button>
            )
          })}
        </div>
      </SettingsRow>
      <Separator />
      <SettingsRow label={t('settings.language')}>
        <NativeSelect
          aria-label={t('settings.language')}
          value={language}
          className="
            w-full
            sm:w-44
          "
          onChange={(event) => {
            const nextLanguage = event.target.value
            if (
              nextLanguage === 'auto'
              || isSupportedLocale(nextLanguage)
            ) {
              void onLanguageChange(nextLanguage)
            }
          }}
        >
          <NativeSelectOption value="auto">
            {t('settings.autoDetect')}
          </NativeSelectOption>
          {localeDefinitions.map(({ locale, nativeName }) => (
            <NativeSelectOption key={locale} value={locale}>
              {nativeName}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </SettingsRow>
      <Separator />
      <SettingsRow
        label={t('cookies.preferences')}
        description={t('cookies.preferencesDescription')}
      >
        <Button
          type="button"
          variant="outline"
          onClick={onOpenCookiePreferences}
        >
          {t('cookies.manage')}
        </Button>
      </SettingsRow>
    </div>
  )
}
