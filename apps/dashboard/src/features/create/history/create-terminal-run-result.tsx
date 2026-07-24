/** Terminal success, partial, and failure presentation for one Create run. */

import type { FlowRunAssetOutput, FlowRunSummary } from '@talelabs/sdk'

import { IconRefresh } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'
import { CreateResultActions } from './create-result-actions'
import { CreateResultMedia } from './create-result-media'
import { createRunStatusKey } from './create-run-presentation'

/** Renders canonical outputs or one persistent actionable terminal state. */
export function CreateTerminalRunResult({
  run,
  onMakeVideo,
  onOpenAsset,
  onRetry,
  onUseAsReference,
}: {
  /** Composes an Image output as a Video start frame. */
  onMakeVideo: (output: FlowRunAssetOutput) => void
  /** Opens the existing shared Asset viewer. */
  onOpenAsset: (assetId: string) => void
  /** Admits a new run from the immutable request. */
  onRetry: (run: FlowRunSummary) => void
  /** Explicitly attaches one canonical output to the next request. */
  onUseAsReference: (output: FlowRunAssetOutput) => void
  /** Terminal immutable run and bounded output presentation. */
  run: FlowRunSummary
}) {
  const { t } = useTranslation()
  if (run.assetOutputs.length === 0) {
    return (
      <div className="
        flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl
        bg-muted/20 p-6 text-center ring-1 ring-border/60
      "
      >
        <p className="text-sm font-medium">
          {t(createRunStatusKey(run.status))}
        </p>
        <p className="max-w-lg text-xs text-muted-foreground">
          {run.errorMessage ?? t('create.history.noOutput')}
        </p>
        {['canceled', 'failed', 'partial'].includes(run.status) && (
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => onRetry(run)}
          >
            <IconRefresh data-icon="inline-start" />
            {t('create.history.retry')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className={cn(
        'grid gap-3',
        run.assetOutputs.length > 1 && 'sm:grid-cols-2',
      )}
      >
        {run.assetOutputs.map(output => (
          <div className="min-w-0" key={`${output.jobId}:${output.outputIndex}`}>
            <CreateResultMedia output={output} onOpenAsset={onOpenAsset} />
            <CreateResultActions
              output={output}
              onMakeVideo={onMakeVideo}
              onOpenAsset={onOpenAsset}
              onUseAsReference={onUseAsReference}
            />
          </div>
        ))}
      </div>
      {run.status === 'partial' && (
        <div className="
          flex flex-wrap items-center justify-between gap-2 rounded-2xl border
          border-warning/50 bg-warning/10 px-3 py-2
        "
        >
          <p className="text-xs text-warning-foreground">
            {t('create.history.partialOutput')}
          </p>
          <Button
            size="xs"
            type="button"
            variant="outline"
            onClick={() => onRetry(run)}
          >
            <IconRefresh data-icon="inline-start" />
            {t('create.history.retry')}
          </Button>
        </div>
      )}
    </div>
  )
}
