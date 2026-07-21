/** One provider's browser-local credential status and management actions. */

import type { SecureStoreProvider } from './secure-store-providers'

import { IconKey } from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'
import { SettingsRow } from './settings-row'

/** Renders one Secure Store provider row with connect, replace, and remove. */
export function SecureStoreProviderRow({
  disabled,
  isRemoving,
  onRemove,
  onReplace,
  onStore,
  provider,
  stored,
}: {
  disabled: boolean
  isRemoving: boolean
  onRemove: () => void
  onReplace: () => void
  onStore: () => void
  provider: SecureStoreProvider
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
            {provider.logoLight && provider.logoDark
              ? (
                  <>
                    <img
                      alt=""
                      className="
                        size-5 object-contain
                        dark:hidden
                      "
                      src={provider.logoLight}
                    />
                    <img
                      alt=""
                      className="
                        hidden size-5 object-contain
                        dark:block
                      "
                      src={provider.logoDark}
                    />
                  </>
                )
              : <IconKey className="size-5 text-muted-foreground" />}
          </span>
          <span>{t(provider.nameKey)}</span>
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
