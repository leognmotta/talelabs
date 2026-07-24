/** Truthful reserved output state for one active Create run. */

import type { FlowRunSummary } from '@talelabs/sdk'

import { IconClock, IconPlayerStop } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { cn } from '@talelabs/ui/lib/utils'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createRunStatusKey } from './create-run-presentation'

/** Reserves media-specific output geometry while a durable run is active. */
export function CreateActiveRunResult({
  run,
  onCancel,
}: {
  /** Requests cancellation through the ordinary run lifecycle. */
  onCancel: (run: FlowRunSummary) => void
  /** Active immutable request summary. */
  run: FlowRunSummary
}) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  const expected = Math.min(4, Math.max(1, run.summary.expectedOutputCount))
  const audio = run.requestSummary?.mediaType === 'audio'
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(run.createdAt).getTime()) / 1_000),
  )
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className={cn('grid gap-3', expected > 1 && 'sm:grid-cols-2')}>
      {Array.from({ length: expected }, (_, index) => (
        <div
          className={cn(
            `
              relative flex items-center justify-center overflow-hidden
              rounded-2xl bg-muted/20 ring-1 ring-border/70
            `,
            audio ? 'min-h-28' : 'aspect-video min-h-40',
          )}
          key={index}
        >
          <Skeleton className="absolute inset-0 rounded-none opacity-35" />
          <div className="
            relative flex flex-col items-center gap-2 p-5 text-center
          "
          >
            <p className="text-sm font-medium">
              {t(createRunStatusKey(run.status))}
            </p>
            {elapsedSeconds >= 20 && (
              <span className="
                inline-flex items-center gap-1 text-xs text-muted-foreground
              "
              >
                <IconClock className="size-3.5" />
                {t('create.history.elapsed', { count: elapsedSeconds })}
              </span>
            )}
            <p className="text-xs text-muted-foreground">
              {t('create.history.keepWorking')}
            </p>
            <Button
              size="xs"
              type="button"
              variant="outline"
              onClick={() => onCancel(run)}
            >
              <IconPlayerStop data-icon="inline-start" />
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
