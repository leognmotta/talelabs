/** Settings surface for encrypted browser-only provider credential storage. */

import type { SecureStoreDialogMode } from './secure-store-credential-dialog'

import { IconShieldLock } from '@tabler/icons-react'
import {
  listCredentialStatuses,
  removeCredential,
} from '@talelabs/providers/browser'
import { Alert, AlertDescription } from '@talelabs/ui/components/alert'
import { Separator } from '@talelabs/ui/components/separator'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSession } from '../auth/auth-client'
import { notifyBrowserCredentialsChanged } from './execution-runtime-preference'
import { SecureStoreCredentialDialog } from './secure-store-credential-dialog'
import { SecureStoreProviderRow } from './secure-store-provider-row'

/** Manages OpenRouter credential status without resolving its plaintext value. */
export function SecureStoreSettings() {
  const { t } = useTranslation()
  const session = useSession()
  const userId = session.data?.user.id
  const [dialogMode, setDialogMode] = useState<SecureStoreDialogMode | null>(
    null,
  )
  const [isRemoving, setIsRemoving] = useState(false)
  const [credentialState, setCredentialState] = useState<{
    status: 'loading' | 'ready' | 'unavailable'
    stored: boolean
    userId: string | undefined
  }>({ status: 'loading', stored: false, userId })
  const currentCredentialState
    = credentialState.userId === userId
      ? credentialState
      : { status: 'loading' as const, stored: false, userId }
  const isLoading = currentCredentialState.status === 'loading'
  const stored = currentCredentialState.stored
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
            stored: statuses.some(
              status => status.providerId === 'openrouter',
            ),
            userId,
          })
        }
      })
      .catch(() => {
        if (active) {
          setCredentialState({
            status: 'unavailable',
            stored: false,
            userId,
          })
        }
      })

    return () => {
      active = false
    }
  }, [userId])

  async function handleRemove() {
    if (!userId)
      return

    setIsRemoving(true)
    try {
      await removeCredential({ providerId: 'openrouter', userId })
      setCredentialState({ status: 'ready', stored: false, userId })
      notifyBrowserCredentialsChanged()
    }
    catch {
      toast.error(t('secureStore.couldNotRemove'))
    }
    finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pr-12 pb-4">
        <h2 className="text-lg font-semibold">{t('settings.secureStore')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('secureStore.description')}
        </p>
      </header>
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
      <SecureStoreProviderRow
        disabled={isLoading || unavailable || !userId}
        isRemoving={isRemoving}
        onRemove={() => void handleRemove()}
        onReplace={() => setDialogMode('replace')}
        onStore={() => setDialogMode('store')}
        stored={stored}
      />
      {userId && dialogMode && (
        <SecureStoreCredentialDialog
          mode={dialogMode}
          onOpenChange={(nextOpen) => {
            if (!nextOpen)
              setDialogMode(null)
          }}
          onStored={() => {
            setCredentialState({ status: 'ready', stored: true, userId })
            notifyBrowserCredentialsChanged()
          }}
          open
          userId={userId}
        />
      )}
    </div>
  )
}
