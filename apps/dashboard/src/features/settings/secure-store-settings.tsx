/** Settings surface for encrypted browser-only provider credential storage. */

import type { BrowserCredentialProviderId } from '@talelabs/providers/browser'
import type { SecureStoreDialogMode } from './secure-store-credential-dialog'

import { IconShieldLock } from '@tabler/icons-react'
import {
  listCredentialStatuses,
  removeCredential,
} from '@talelabs/providers/browser'
import { Alert, AlertDescription } from '@talelabs/ui/components/alert'
import { Separator } from '@talelabs/ui/components/separator'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@talelabs/ui/components/toggle-group'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSession } from '../auth/auth-client'
import { notifyBrowserCredentialsChanged } from './execution-runtime-preference'
import { useGenerationFundingPreference } from './generation-funding-preference'
import { SecureStoreCredentialDialog } from './secure-store-credential-dialog'
import { SecureStoreProviderRow } from './secure-store-provider-row'
import { SECURE_STORE_PROVIDERS } from './secure-store-providers'
import { SettingsRow } from './settings-row'

interface SecureStoreDialogTarget {
  mode: SecureStoreDialogMode
  providerId: BrowserCredentialProviderId
}

/** Manages each provider's credential status without resolving plaintext keys. */
export function SecureStoreSettings() {
  const { t } = useTranslation()
  const session = useSession()
  const userId = session.data?.user.id
  const [fundingPreference, setFundingPreference]
    = useGenerationFundingPreference(userId)
  const [dialogTarget, setDialogTarget] = useState<SecureStoreDialogTarget | null>(
    null,
  )
  const [removingProviderId, setRemovingProviderId]
    = useState<BrowserCredentialProviderId | null>(null)
  const [credentialState, setCredentialState] = useState<{
    status: 'loading' | 'ready' | 'unavailable'
    stored: ReadonlySet<BrowserCredentialProviderId>
    userId: string | undefined
  }>(() => ({ status: 'loading', stored: new Set(), userId }))
  const currentCredentialState
    = credentialState.userId === userId
      ? credentialState
      : {
          status: 'loading' as const,
          stored: new Set<BrowserCredentialProviderId>(),
          userId,
        }
  const isLoading = currentCredentialState.status === 'loading'
  const unavailable
    = currentCredentialState.status === 'unavailable' || !userId

  useEffect(() => {
    let active = true
    if (!userId)
      return

    void listCredentialStatuses({ userId })
      .then((statuses) => {
        if (active) {
          setCredentialState({
            status: 'ready',
            stored: new Set(statuses.map(status => status.providerId)),
            userId,
          })
        }
      })
      .catch(() => {
        if (active) {
          setCredentialState({
            status: 'unavailable',
            stored: new Set(),
            userId,
          })
        }
      })

    return () => {
      active = false
    }
  }, [userId])

  async function handleRemove(providerId: BrowserCredentialProviderId) {
    if (!userId)
      return

    setRemovingProviderId(providerId)
    try {
      await removeCredential({ providerId, userId })
      setCredentialState((previous) => {
        const stored = new Set(previous.stored)
        stored.delete(providerId)
        return { status: 'ready', stored, userId }
      })
      notifyBrowserCredentialsChanged()
    }
    catch {
      toast.error(t('secureStore.couldNotRemove'))
    }
    finally {
      setRemovingProviderId(null)
    }
  }

  const dialogProvider = dialogTarget
    && SECURE_STORE_PROVIDERS.find(provider => provider.id === dialogTarget.providerId)

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pr-12 pb-4">
        <h2 className="text-lg font-semibold">{t('settings.secureStore')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('secureStore.description')}
        </p>
      </header>
      <Separator />
      <section className="pt-5">
        <h3 className="text-sm font-semibold">
          {t('secureStore.generationMode')}
        </h3>
        <Separator className="mt-3" />
        <SettingsRow
          description={fundingPreference === 'credits'
            ? t('secureStore.creditsDescription')
            : t('secureStore.byokDescription')}
          label={t('secureStore.preferredMode')}
        >
          <ToggleGroup
            aria-label={t('secureStore.preferredMode')}
            disabled={!userId}
            size="sm"
            value={[fundingPreference]}
            variant="filled"
            onValueChange={(values) => {
              const next = values.at(-1)
              if (next === 'credits' || next === 'byok')
                setFundingPreference(next)
            }}
          >
            <ToggleGroupItem value="credits">
              {t('secureStore.credits')}
            </ToggleGroupItem>
            <ToggleGroupItem value="byok">
              {t('secureStore.byok')}
            </ToggleGroupItem>
          </ToggleGroup>
        </SettingsRow>
      </section>
      <Separator />
      <Alert className="my-5">
        <IconShieldLock />
        <AlertDescription>{t('secureStore.securityNotice')}</AlertDescription>
      </Alert>
      {unavailable && (
        <Alert variant="destructive" className="mb-1">
          <AlertDescription>{t('secureStore.unavailable')}</AlertDescription>
        </Alert>
      )}
      {SECURE_STORE_PROVIDERS.map(provider => (
        <SecureStoreProviderRow
          disabled={isLoading || unavailable || !userId}
          isRemoving={removingProviderId === provider.id}
          key={provider.id}
          onRemove={() => void handleRemove(provider.id)}
          onReplace={() => setDialogTarget({ mode: 'replace', providerId: provider.id })}
          onStore={() => setDialogTarget({ mode: 'store', providerId: provider.id })}
          provider={provider}
          stored={currentCredentialState.stored.has(provider.id)}
        />
      ))}
      {userId && dialogTarget && dialogProvider && (
        <SecureStoreCredentialDialog
          mode={dialogTarget.mode}
          onOpenChange={(nextOpen) => {
            if (!nextOpen)
              setDialogTarget(null)
          }}
          onStored={() => {
            const providerId = dialogTarget.providerId
            setCredentialState((previous) => {
              const stored = new Set(previous.stored)
              stored.add(providerId)
              return { status: 'ready', stored, userId }
            })
            notifyBrowserCredentialsChanged()
          }}
          open
          providerId={dialogProvider.id}
          providerName={t(dialogProvider.nameKey)}
          userId={userId}
        />
      )}
    </div>
  )
}
