/**
 * Branded full-screen loading state for dashboard and route transitions.
 *
 */

import { useTranslation } from 'react-i18next'
import { TaleLabsLogo } from './talelabs-logo'

/** Presents a compact TaleLabs loading state with optional contextual copy. */
export function SplashScreen({
  message,
}: {
  message?: string
}) {
  const { t } = useTranslation()

  return (
    <main className="
      fixed inset-0 z-50 flex items-center justify-center overflow-hidden
      bg-background px-6 py-10 text-foreground
    "
    >
      <section
        aria-live="polite"
        className="
          relative flex w-full max-w-xs flex-col items-center text-center
        "
        role="status"
      >
        <div className="
          flex size-24 items-center justify-center rounded-2xl border
          border-border/70 bg-card shadow-lg
        "
        >
          <TaleLabsLogo className="size-16" variant="icon" />
        </div>

        <h1 className="mt-7 text-xl font-semibold tracking-tight">
          TaleLabs
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {message ?? t('workspace.loading')}
        </p>

        <div
          aria-hidden="true"
          className="mt-8 h-px w-28 overflow-hidden bg-border"
        >
          <div
            className="h-full w-2/5 bg-foreground"
            data-splash-progress
          >
          </div>
        </div>
      </section>
    </main>
  )
}
