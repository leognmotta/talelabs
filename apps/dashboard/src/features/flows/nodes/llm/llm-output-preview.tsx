import type { FlowGenerationPreview } from '../../flow-canvas-types'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { IconCopy, IconTextCaption } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'
import { useCopyOutputText } from '../../use-copy-output-text'
import { GenerationPreviewStage } from '../generation-preview-stage'

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
    && preview.fingerprint !== currentFingerprint,
  )
  const output = preview?.status === 'succeeded'
    && preview.output.kind === 'text'
    ? preview.output.text
    : null
  const stateLabel = preview?.status === 'pending'
    ? t('flows.llm.preview.pending')
    : preview?.status === 'error'
      ? t(preview.errorKey)
      : stale
        ? t('flows.llm.preview.stale')
        : output ?? ''
  const readinessMessage = t(readinessMessageKey)
  const copyOutputText = useCopyOutputText(output)

  return (
    <GenerationPreviewStage
      aria-label={t('flows.llm.preview.openFull')}
      className="
        nodrag nopan cursor-pointer outline-none
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset
      "
      data-llm-output-preview
      data-preview-state={stale ? 'stale' : preview?.status ?? 'empty'}
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
      {output && (
        <Button
          className="
            absolute top-3 right-3 z-10 border-border/75 bg-card/78 shadow-sm
            backdrop-blur-sm
          "
          aria-label={t('flows.llm.preview.copy')}
          size="icon-xs"
          title={t('flows.llm.preview.copy')}
          type="button"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation()
            void copyOutputText()
          }}
        >
          <IconCopy />
        </Button>
      )}
      {preview
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
                  output && 'pr-7',
                  !output && 'text-muted-foreground',
                  stale && `
                    text-amber-700
                    dark:text-amber-300
                  `,
                  preview.status === 'error' && 'text-destructive',
                )}
              >
                {stateLabel}
              </p>
            </div>
          )
        : (
            <div className="absolute inset-0 flex items-center justify-center">
              <IconTextCaption
                aria-hidden
                className="size-10 text-foreground/30"
                stroke={1.25}
              />
            </div>
          )}
    </GenerationPreviewStage>
  )
}
