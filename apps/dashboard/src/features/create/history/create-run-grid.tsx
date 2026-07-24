/** Media-first grid projection over cursor-paged Create run history. */

import type {
  FlowRunAssetOutput,
  FlowRunSummary,
  GenerationConfigResponse,
} from '@talelabs/sdk'
import type { CSSProperties } from 'react'
import type { CreateRunGridEntry } from './create-run-grid-layout'

import { Button } from '@talelabs/ui/components/button'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CreateRunGridCard } from './create-run-grid-card'
import {
  packCreateRunGridRows,
  resolveCreateRunGridAspectRatio,
} from './create-run-grid-layout'

/** Renders newest-first result cards without creating another history query. */
export function CreateRunGrid({
  generationConfig,
  hasEarlier,
  loadingEarlier,
  runs,
  scrollTargetRunId,
  onCancel,
  onLoadEarlier,
  onMakeVideo,
  onOpenAsset,
  onRetry,
  onReuseRequest,
  onUseAsReference,
}: {
  /** Sanitized generation presentation catalog. */
  generationConfig: GenerationConfigResponse
  /** Whether another cursor page is available. */
  hasEarlier: boolean
  /** Cursor request state for the explicit history boundary. */
  loadingEarlier: boolean
  /** Newest-first summaries loaded from creator-scoped direct history. */
  runs: readonly FlowRunSummary[]
  /** Exact run returned by the latest user-initiated Generate command. */
  scrollTargetRunId: null | string
  /** Requests durable cancellation through the ordinary run API. */
  onCancel: (run: FlowRunSummary) => void
  /** Appends the next older cursor page. */
  onLoadEarlier: () => void
  /** Composes an Image output as a Video start frame. */
  onMakeVideo: (output: FlowRunAssetOutput) => void
  /** Opens the existing shared Asset viewer. */
  onOpenAsset: (assetId: string) => void
  /** Admits a new retry from immutable historical state. */
  onRetry: (run: FlowRunSummary) => void
  /** Restores one immutable request summary into the current draft. */
  onReuseRequest: (run: FlowRunSummary) => void
  /** Explicitly attaches one prior result to the next request. */
  onUseAsReference: (output: FlowRunAssetOutput) => void
}) {
  const { t } = useTranslation()
  const targetItemRef = useRef<HTMLElement>(null)
  const entries = useMemo(() => {
    const nextEntries: CreateRunGridEntry[] = []
    for (const run of runs) {
      const reserved = run.status === 'pending' || run.status === 'running'
      if (reserved) {
        const expected = Math.min(
          16,
          Math.max(1, run.summary.expectedOutputCount),
        )
        for (let outputPosition = 0; outputPosition < expected; outputPosition++) {
          nextEntries.push({
            aspectRatio: resolveCreateRunGridAspectRatio(null, run),
            key: `${run.id}:reserved:${outputPosition}`,
            output: null,
            primary: outputPosition === 0,
            reserved: true,
            run,
          })
        }
        continue
      }
      if (run.assetOutputs.length > 0) {
        run.assetOutputs.forEach((output, outputPosition) => {
          nextEntries.push({
            aspectRatio: resolveCreateRunGridAspectRatio(output, run),
            key: `${run.id}:${output.jobId}:${output.outputIndex}`,
            output,
            primary: outputPosition === 0,
            reserved: false,
            run,
          })
        })
        continue
      }
      nextEntries.push({
        aspectRatio: resolveCreateRunGridAspectRatio(null, run),
        key: `${run.id}:empty`,
        output: null,
        primary: true,
        reserved: false,
        run,
      })
    }
    return nextEntries
  }, [runs])
  const rows = useMemo(() => packCreateRunGridRows(entries), [entries])
  const targetEntryKey = useMemo(() => {
    const targetEntry = entries
      .find(entry => entry.run.id === scrollTargetRunId)
    return targetEntry?.key
  }, [entries, scrollTargetRunId])

  useEffect(() => {
    if (!targetEntryKey || !targetItemRef.current)
      return
    const frame = window.requestAnimationFrame(() => {
      targetItemRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'start',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [targetEntryKey])

  return (
    <div
      aria-label={t('create.history.label')}
      className="
        size-full min-h-0 scrollbar-thin scrollbar-gutter-stable overflow-y-auto
        overscroll-contain
      "
    >
      <div className="
        mx-auto w-full max-w-[1800px] px-3 pt-20
        pb-[calc(var(--create-composer-inset,0)+2.5rem)]
        sm:px-4
      "
      >
        <div className="flex flex-col gap-1">
          {rows.map(row => (
            <div
              className="
                grid w-full grid-cols-1 items-start gap-1
                md:w-(--create-grid-width) md:grid-cols-(--create-grid-columns)
              "
              data-create-history-row={row.key}
              key={row.key}
              style={{
                '--create-grid-columns': row.templateColumns,
                '--create-grid-width': row.width,
              } as CSSProperties}
            >
              {row.entries.map(entry => (
                <CreateRunGridCard
                  articleRef={entry.key === targetEntryKey
                    ? targetItemRef
                    : undefined}
                  aspectRatio={entry.aspectRatio}
                  generationConfig={generationConfig}
                  key={entry.key}
                  output={entry.output}
                  primary={entry.primary}
                  reserved={entry.reserved}
                  run={entry.run}
                  onCancel={onCancel}
                  onMakeVideo={onMakeVideo}
                  onOpenAsset={onOpenAsset}
                  onRetry={onRetry}
                  onReuseRequest={onReuseRequest}
                  onUseAsReference={onUseAsReference}
                />
              ))}
            </div>
          ))}
        </div>
        {hasEarlier && (
          <div className="flex justify-center py-8">
            <Button
              disabled={loadingEarlier}
              size="sm"
              type="button"
              variant="outline"
              onClick={onLoadEarlier}
            >
              {loadingEarlier
                ? t('common.loading')
                : t('create.history.loadEarlier')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
