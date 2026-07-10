import type { OrganizationStatus } from '../../shared/types/auth'

import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'

import { SplashScreen } from '../../shared/components/splash-screen'

export function WorkspaceState({
  message,
  status,
  onSignOut,
}: {
  message: string
  status: OrganizationStatus
  onSignOut: () => Promise<void>
}) {
  const { t } = useTranslation()

  if (status !== 'error')
    return <SplashScreen message={t('workspace.opening')} />

  return (
    <main className="
      flex min-h-screen items-center justify-center bg-background px-6 py-8
      text-foreground
    "
    >
      <section className="
        flex w-full max-w-md flex-col gap-4 rounded-lg border border-border
        bg-card p-6 text-card-foreground shadow-lg
      "
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">TaleLabs</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('workspace.accessUnavailable')}
          </h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" onClick={onSignOut}>
          {t('common.signOut')}
        </Button>
      </section>
    </main>
  )
}
