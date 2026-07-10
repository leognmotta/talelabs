import { IconDeviceDesktop, IconLogout, IconRefresh } from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { Separator } from '@talelabs/ui/components/separator'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useLanguage } from '../../i18n/language-context'
import { getAuthErrorMessage } from '../../shared/lib/auth-error'
import { authClient } from '../auth/auth-client'
import { PasswordSettingsForm } from './password-settings-form'
import {
  formatSessionDate,
  getBrowserName,
  getDeviceName,
} from './settings-utils'

type AuthSession = NonNullable<
  Awaited<ReturnType<typeof authClient.listSessions>>['data']
>[number]
type AuthAccount = NonNullable<
  Awaited<ReturnType<typeof authClient.listAccounts>>['data']
>[number]

export function SecuritySettings({
  currentSessionId,
  onSignOut,
  open,
}: {
  currentSessionId: string | undefined
  onSignOut: () => Promise<void>
  open: boolean
}) {
  const { t } = useTranslation()
  const { locale } = useLanguage()
  const [sessions, setSessions] = useState<AuthSession[]>([])
  const [accounts, setAccounts] = useState<AuthAccount[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false)
  const [revokingToken, setRevokingToken] = useState<string | null>(null)
  const hasPassword = accounts.some(account => account.providerId === 'credential')

  async function loadSessions() {
    setIsLoading(true)
    setError(null)

    const [sessionsResult, accountsResult] = await Promise.all([
      authClient.listSessions(),
      authClient.listAccounts(),
    ])

    if (sessionsResult.error) {
      setError(getAuthErrorMessage(sessionsResult.error, 'security.couldNotLoadSessions'))
      setIsLoading(false)
      return
    }

    if (accountsResult.error) {
      setError(getAuthErrorMessage(accountsResult.error, 'security.couldNotLoad'))
      setIsLoading(false)
      return
    }

    setSessions(sessionsResult.data ?? [])
    setAccounts(accountsResult.data ?? [])
    setIsLoading(false)
  }

  useEffect(() => {
    if (open)
      void loadSessions()
  }, [open])

  async function handleRevokeSession(session: AuthSession) {
    const isCurrentSession = session.id === currentSessionId

    setRevokingToken(session.token)
    const result = await authClient.revokeSession({ token: session.token })

    if (result.error) {
      toast.error(getAuthErrorMessage(result.error, 'security.couldNotRevoke'))
      setRevokingToken(null)
      return
    }

    if (isCurrentSession) {
      await onSignOut()
      return
    }

    await loadSessions()
    setRevokingToken(null)
    toast.success(t('security.sessionRevoked'))
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 pr-12 pb-4">
        <h2 className="text-lg font-semibold">{t('settings.security')}</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadSessions()}
          disabled={isLoading}
        >
          <IconRefresh />
          {t('security.refresh')}
        </Button>
      </header>
      <Separator />
      <div className="py-5">
        <div className="
          flex flex-col gap-3
          sm:flex-row sm:items-start sm:justify-between
        "
        >
          <div>
            <p className="text-sm font-medium">{t('common.password')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasPassword
                ? t('security.passwordUpdateDescription')
                : t('security.passwordCreateDescription')}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => setIsPasswordFormOpen(open => !open)}
          >
            {hasPassword ? t('security.updatePassword') : t('security.createPassword')}
          </Button>
        </div>
        {isPasswordFormOpen && (
          <div className="mt-5 max-w-sm">
            {isLoading
              ? <Skeleton className="h-28 w-full" />
              : (
                  <PasswordSettingsForm
                    hasPassword={hasPassword}
                    onPasswordChanged={async () => {
                      await loadSessions()
                      setIsPasswordFormOpen(false)
                    }}
                  />
                )}
          </div>
        )}
      </div>
      <Separator />
      <div className="py-5">
        <div className="
          grid gap-3
          sm:grid-cols-[minmax(9rem,13rem)_1fr]
        "
        >
          <p className="text-sm font-medium">{t('security.activeSessions')}</p>
          <div className="flex min-w-0 flex-col gap-3">
            {isLoading && sessions.length === 0 && (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {!isLoading && !error && sessions.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('security.noSessions')}</p>
            )}
            {sessions.map((session) => {
              const isCurrentSession = session.id === currentSessionId
              const browserName = getBrowserName(session.userAgent) ?? t('security.browser')
              const deviceName = getDeviceName(session.userAgent) ?? t('security.device')

              return (
                <div
                  key={session.id}
                  className="
                    flex flex-col gap-3 rounded-2xl border border-border p-4
                    sm:flex-row sm:items-start sm:justify-between
                  "
                >
                  <div className="flex min-w-0 gap-3">
                    <span className="
                      mt-0.5 flex size-9 shrink-0 items-center justify-center
                      rounded-xl bg-muted text-muted-foreground
                    "
                    >
                      <IconDeviceDesktop />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{deviceName}</p>
                        {isCurrentSession && (
                          <Badge variant="secondary">{t('security.currentSession')}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {browserName}
                        {session.ipAddress ? ` - ${session.ipAddress}` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('security.lastActive', {
                          date: formatSessionDate(session.updatedAt, locale),
                        })}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={isCurrentSession ? 'outline' : 'destructive'}
                    size="sm"
                    disabled={revokingToken === session.token}
                    onClick={() => void handleRevokeSession(session)}
                  >
                    <IconLogout />
                    {isCurrentSession ? t('common.signOut') : t('security.revoke')}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
