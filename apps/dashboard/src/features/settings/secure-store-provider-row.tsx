/** OpenRouter credential status and browser-local management actions. */

import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'
import openRouterDarkLogo from './openrouter-glyph-dark.svg'
import openRouterLightLogo from './openrouter-glyph-light.svg'
import { SettingsRow } from './settings-row'

/** Renders the only provider currently supported by Secure Store. */
export function SecureStoreProviderRow({
  disabled,
  isRemoving,
  onRemove,
  onReplace,
  onStore,
  stored,
}: {
  disabled: boolean
  isRemoving: boolean
  onRemove: () => void
  onReplace: () => void
  onStore: () => void
  stored: boolean
}) {
  const { t } = useTranslation()

  return (
    <SettingsRow
      label={(
        <span className="flex items-center gap-3">
          <span className="
            flex size-9 shrink-0 items-center justify-center rounded-xl border
            border-border/70 bg-background/75 shadow-xs
          "
          >
            <img
              alt=""
              className="
                size-5 object-contain
                dark:hidden
              "
              src={openRouterLightLogo}
            />
            <img
              alt=""
              className="
                hidden size-5 object-contain
                dark:block
              "
              src={openRouterDarkLogo}
            />
          </span>
          <span>{t('secureStore.openRouter')}</span>
        </span>
      )}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        {stored && (
          <Badge variant="secondary">
            {t('secureStore.storedInBrowser')}
          </Badge>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={stored ? onReplace : onStore}
        >
          {stored ? t('secureStore.replaceKey') : t('secureStore.storeKey')}
        </Button>
        {stored && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={disabled || isRemoving}
            onClick={onRemove}
          >
            {isRemoving
              ? t('secureStore.removing')
              : t('secureStore.removeKey')}
          </Button>
        )}
      </div>
    </SettingsRow>
  )
}
