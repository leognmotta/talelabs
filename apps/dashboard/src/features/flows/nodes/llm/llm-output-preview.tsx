/** LLM generation-node preview for durable and in-flight text outputs. */

import type { FlowGenerationPreview } from '../../editor/flow-canvas-types'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { IconTextCaption } from '@tabler/icons-react'
import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'
import { GenerationPreviewEmptyState } from '../shared/generation-node/generation-preview-empty-state'
import { GenerationPreviewStage } from '../shared/generation-node/generation-preview-stage'

/** Renders the latest canonical LLM output and its active run state. */
export function LlmOutputPreview({
  currentFingerprint,
  preview,
  readiness,
  readinessMessageKey,
  onOpen,
}: {
  currentFingerprint: null | string
  onOpen: () => void
  preview?: FlowGenerationPreview
  readiness: 'incomplete' | 'invalid' | 'ready'
  readinessMessageKey: string
}) {
  const { t } = useTranslation()
  const stale = Boolean(
    preview
    && preview.status === 'succeeded'
    && !preview.resultSets?.length
    && preview.fingerprint !== currentFingerprint,
  )
  const output = preview
    && 'output' in preview
    && preview.output?.kind === 'text'
    ? preview.output.text
    : null
  const showPreviewState = Boolean(
    preview && (preview.status !== 'error' || output),
  )
  const stateLabel = preview?.status === 'pending'
    ? t('flows.llm.preview.pending')
    : stale
      ? t('flows.llm.preview.stale')
      : output ?? ''
  const readinessMessage = t(readinessMessageKey)

  return (
    <GenerationPreviewStage
      aria-label={t('flows.llm.preview.openFull')}
      className="
        nodrag nopan cursor-pointer outline-none
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset
      "
      data-llm-output-preview
      data-preview-state={stale ? 'stale' : (preview?.status ?? 'empty')}
      readiness={readiness}
      readinessMessage={readinessMessage}
      role="button"
      tabIndex={0}
      valueType="Text"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      {showPreviewState
        ? (
            <div
              className={cn(
                'absolute inset-0 p-5 pb-12',
                !output && 'flex items-center justify-center text-center',
              )}
            >
              <p
                className={cn(
                  `
                    line-clamp-10 text-sm/relaxed whitespace-pre-wrap
                    text-foreground/85
                  `,
                  !output && 'text-muted-foreground',
                  stale && `text-warning`,
                )}
              >
                {stateLabel}
              </p>
            </div>
          )
        : (
            <div className="absolute inset-0 flex items-center justify-center">
              <GenerationPreviewEmptyState
                icon={IconTextCaption}
                message={readinessMessage}
              />
            </div>
          )}
    </GenerationPreviewStage>
  )
}
