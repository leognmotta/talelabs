import type { OrganizationStatus } from '../types/auth'

import { Button } from '@connecto/ui/components/button'

import { SplashScreen } from './splash-screen'

export function WorkspaceState({
  message,
  status,
  onSignOut,
}: {
  message: string
  status: OrganizationStatus
  onSignOut: () => Promise<void>
}) {
  if (status !== 'error')
    return <SplashScreen message="Opening your workspace" />

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
          <p className="text-sm font-medium text-muted-foreground">Connecto</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Organization access unavailable
          </h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" onClick={onSignOut}>
          Sign out
        </Button>
      </section>
    </main>
  )
}
