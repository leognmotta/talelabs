import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'

export function ErrorFallback({
  description,
  fullScreen = false,
  onRetry,
  title,
}: {
  description?: string
  fullScreen?: boolean
  onRetry: () => void
  title?: string
}) {
  const { t } = useTranslation()

  return (
    <main
      className={cn(
        `
          flex min-h-80 flex-1 items-center justify-center px-6 py-10
          text-foreground
        `,
        fullScreen && 'min-h-svh',
      )}
    >
      <section
        aria-live="assertive"
        className="flex w-full max-w-md flex-col items-center gap-5 text-center"
        role="alert"
      >
        <div className="
          flex size-12 items-center justify-center rounded-xl bg-destructive/10
          text-destructive
        "
        >
          <IconAlertTriangle aria-hidden="true" className="size-6" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {title ?? t('errors.unexpectedTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {description ?? t('errors.unexpectedDescription')}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={onRetry}>
            {t('common.retry')}
          </Button>
          <Button type="button" onClick={() => window.location.reload()}>
            <IconRefresh aria-hidden="true" data-icon="inline-start" />
            {t('common.reload')}
          </Button>
        </div>
      </section>
    </main>
  )
}
