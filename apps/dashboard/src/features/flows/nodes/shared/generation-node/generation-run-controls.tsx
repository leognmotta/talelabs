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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GenerationRunCostEstimate } from '../../../../generation/runs/generation-run-cost-estimate'
import { useFlowCanvasRuntime, useFlowGenerationPreview } from '../../../editor/flow-canvas-runtime-context'
import {
  isRunCostEstimateReady,
  useFlowRunCostEstimate,
} from '../../../runs/cost-estimation/use-flow-run-cost-estimate'
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
  const [optionsOpen, setOptionsOpen] = useState(false)
  const runtime = useFlowCanvasRuntime()
  const label = t('flows.nodeToolbar.run')
  const optionsLabel = t('flows.nodeToolbar.runOptions')
  const preview = useFlowGenerationPreview(nodeId)
  const previewStatus = preview?.status
  const retryAvailable = Boolean(preview?.retrySource)
  const running = previewStatus === 'pending'
  const queued = previewStatus === 'queued'
  const hasRunnablePlan = Boolean(runtime.getGenerationPreviewFingerprint(nodeId))
  const executionDisabled = (!canRun && !hasRunnablePlan)
    || running
    || queued
  const nodeCost = useFlowRunCostEstimate({
    command: { mode: 'node', targetNodeId: nodeId },
    enabled: hasRunnablePlan,
  })
  const fromHereCost = useFlowRunCostEstimate({
    command: { mode: 'downstream', targetNodeId: nodeId },
    enabled: optionsOpen,
  })
  const tillHereCost = useFlowRunCostEstimate({
    command: { mode: 'upstream', targetNodeId: nodeId },
    enabled: optionsOpen,
  })
  const runDisabled = executionDisabled || !isRunCostEstimateReady(nodeCost)
  const optionsDisabled = executionDisabled && !retryAvailable
  const fromHereDisabled = executionDisabled || !isRunCostEstimateReady(fromHereCost)
  const tillHereDisabled = executionDisabled || !isRunCostEstimateReady(tillHereCost)

  return (
    <div
      className="nodrag nopan flex items-center gap-1"
      data-flow-run-actions
    >
      <GenerationRunCostEstimate
        className="
          rounded-md border border-border/60 bg-background/70 px-1.5 py-1
        "
        state={nodeCost}
      />
      <div className="flex items-stretch">
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
        <DropdownMenu open={optionsOpen} onOpenChange={setOptionsOpen}>
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
              className="items-start justify-between gap-4 py-3"
              disabled={fromHereDisabled}
              onClick={() => void runtime.runGenerationPreview(nodeId, 'fromHere')}
            >
              <span className="flex flex-col gap-0.5">
                <span>{t('flows.nodeToolbar.runFromHere')}</span>
                <span className="font-normal text-muted-foreground">
                  {t('flows.nodeToolbar.runFromHereDescription')}
                </span>
              </span>
              <GenerationRunCostEstimate showTooltip={false} state={fromHereCost} />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="items-start justify-between gap-4 py-3"
              disabled={tillHereDisabled}
              onClick={() => void runtime.runGenerationPreview(nodeId, 'tillHere')}
            >
              <span className="flex flex-col gap-0.5">
                <span>{t('flows.nodeToolbar.runTillHere')}</span>
                <span className="font-normal text-muted-foreground">
                  {t('flows.nodeToolbar.runTillHereDescription')}
                </span>
              </span>
              <GenerationRunCostEstimate showTooltip={false} state={tillHereCost} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
