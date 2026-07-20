/** Durable run and retry commands rendered in a generation node's footer. */
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { IconChevronDown, IconPlayerPlayFilled } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useTranslation } from 'react-i18next'
import { useFlowCanvasRuntime, useFlowGenerationPreview } from '../../../editor/flow-canvas-runtime-context'
import { FlowActionTooltip } from '../toolbars/flow-action-tooltip'

/** Renders run, scoped-run, and retry commands for one generation node. */
export function GenerationRunControls({
  canRun,
  nodeId,
}: {
  canRun: boolean
  nodeId: string
}) {
  const { t } = useTranslation()
  const runtime = useFlowCanvasRuntime()
  const label = t('flows.nodeToolbar.run')
  const optionsLabel = t('flows.nodeToolbar.runOptions')
  const preview = useFlowGenerationPreview(nodeId)
  const previewStatus = preview?.status
  const retryAvailable = Boolean(preview?.retrySource)
  const running = previewStatus === 'pending'
  const queued = previewStatus === 'queued'
  const hasRunnablePlan = Boolean(runtime.getGenerationPreviewFingerprint(nodeId))
  const runDisabled = (!canRun && !hasRunnablePlan)
    || running
    || queued
  const optionsDisabled = runDisabled && !retryAvailable

  return (
    <div className="nodrag nopan flex items-stretch" data-flow-run-actions>
      <FlowActionTooltip disabled={runDisabled} label={label}>
        <Button
          aria-busy={running}
          className="rounded-r-none border-r-primary-foreground/20"
          disabled={runDisabled}
          size="xs"
          type="button"
          onClick={() => void runtime.runGenerationPreview(nodeId)}
        >
          {running
            ? <Spinner aria-hidden="true" className="size-3" />
            : <IconPlayerPlayFilled aria-hidden="true" />}
          {label}
        </Button>
      </FlowActionTooltip>
      <DropdownMenu>
        <FlowActionTooltip label={optionsLabel}>
          <DropdownMenuTrigger
            disabled={optionsDisabled}
            render={(
              <Button
                aria-label={optionsLabel}
                className="rounded-l-none border-l-0"
                disabled={optionsDisabled}
                size="icon-xs"
                type="button"
              >
                <IconChevronDown />
              </Button>
            )}
          />
        </FlowActionTooltip>
        <DropdownMenuContent
          align="end"
          className="w-64"
          sideOffset={8}
        >
          {retryAvailable
            ? (
                <>
                  <DropdownMenuItem
                    className="items-start py-3"
                    onClick={() => void runtime.retryGenerationRun(nodeId)}
                  >
                    {t('flows.nodeToolbar.retryEntireRun')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )
            : null}
          <DropdownMenuItem
            className="items-start py-3"
            disabled={runDisabled}
            onClick={() => void runtime.runGenerationPreview(nodeId, 'fromHere')}
          >
            <span className="flex flex-col gap-0.5">
              <span>{t('flows.nodeToolbar.runFromHere')}</span>
              <span className="font-normal text-muted-foreground">
                {t('flows.nodeToolbar.runFromHereDescription')}
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="items-start py-3"
            disabled={runDisabled}
            onClick={() => void runtime.runGenerationPreview(nodeId, 'tillHere')}
          >
            <span className="flex flex-col gap-0.5">
              <span>{t('flows.nodeToolbar.runTillHere')}</span>
              <span className="font-normal text-muted-foreground">
                {t('flows.nodeToolbar.runTillHereDescription')}
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
