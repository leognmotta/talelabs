/** Durable Create stream composed from bounded direct run history. */

import type {
  FlowRunAssetOutput,
  FlowRunSummary,
  GenerationConfigResponse,
} from '@talelabs/sdk'

import { IconArrowDown } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@talelabs/ui/components/message-scroller'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CreateActiveRunResult } from './create-active-run-result'
import { CreateRunRequestSummary } from './create-run-request-summary'
import { CreateRunScrollController } from './create-run-scroll-controller'
import { CreateTerminalRunResult } from './create-terminal-run-result'

/** Renders oldest-loaded to newest request groups without mounting editors. */
export function CreateRunStream({
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
  /** Prepends the next older cursor page. */
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
  const chronological = useMemo(() => [...runs].reverse(), [runs])
  const targetItemRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller>
        <MessageScrollerViewport
          aria-label={t('create.history.label')}
          ref={viewportRef}
        >
          <MessageScrollerContent className="
            mx-auto w-full max-w-5xl gap-12 px-4 pt-8
            pb-[calc(var(--create-composer-inset,0)+2.5rem)]
            sm:px-6 sm:pt-10
          "
          >
            {hasEarlier && (
              <div className="flex justify-center">
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
            {chronological.map(run => (
              <MessageScrollerItem
                className="
                  border-b border-border/50 pb-10
                  last:border-b-0 last:pb-0
                "
                key={run.id}
                messageId={run.id}
                ref={run.id === scrollTargetRunId ? targetItemRef : undefined}
              >
                <article className="space-y-4">
                  <CreateRunRequestSummary
                    generationConfig={generationConfig}
                    run={run}
                    onReuseRequest={onReuseRequest}
                  />
                  {run.status === 'pending' || run.status === 'running'
                    ? <CreateActiveRunResult run={run} onCancel={onCancel} />
                    : (
                        <CreateTerminalRunResult
                          run={run}
                          onMakeVideo={onMakeVideo}
                          onOpenAsset={onOpenAsset}
                          onRetry={onRetry}
                          onUseAsReference={onUseAsReference}
                        />
                      )}
                </article>
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <CreateRunScrollController
          targetItemRef={targetItemRef}
          targetMounted={Boolean(
            scrollTargetRunId
            && runs.some(run => run.id === scrollTargetRunId),
          )}
          targetRunId={scrollTargetRunId}
          viewportRef={viewportRef}
        />
        <MessageScrollerButton
          aria-label={t('create.history.scrollToLatest')}
          style={{
            bottom: 'calc(var(--create-composer-inset, 0px) + 1rem)',
          }}
        >
          <IconArrowDown aria-hidden="true" />
        </MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
