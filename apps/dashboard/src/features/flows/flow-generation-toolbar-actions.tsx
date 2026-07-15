import { IconChevronDown } from '@tabler/icons-react'
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
import { FlowActionTooltip } from './flow-action-tooltip'
import { useFlowCanvas } from './flow-canvas-context'

export function FlowGenerationToolbarActions({
  canRun,
  nodeId,
}: {
  canRun: boolean
  nodeId: string
}) {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const label = t('flows.nodeToolbar.run')
  const optionsLabel = t('flows.nodeToolbar.runOptions')
  const preview = canvas.getGenerationPreview(nodeId)
  const previewStatus = preview?.status
  const retryAvailable = Boolean(preview?.retrySource)
  const running = previewStatus === 'pending'
  const queued = previewStatus === 'queued'
  const hasRunnablePlan = Boolean(canvas.getGenerationPreviewFingerprint(nodeId))
  const runDisabled = (!canRun && !hasRunnablePlan) || running || queued
  const optionsDisabled = runDisabled && !retryAvailable

  return (
    <div className="flex items-stretch" data-flow-run-actions>
      <FlowActionTooltip disabled={runDisabled} label={label}>
        <Button
          aria-busy={running}
          className="rounded-r-none border-r-primary-foreground/20"
          disabled={runDisabled}
          size="sm"
          type="button"
          onClick={() => void canvas.runGenerationPreview(nodeId)}
        >
          {running && <Spinner aria-hidden="true" className="size-3.5" />}
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
                size="icon-sm"
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
                    onClick={() => void canvas.retryGenerationRun(nodeId)}
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
            onClick={() => void canvas.runGenerationPreview(nodeId, 'fromHere')}
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
            onClick={() => void canvas.runGenerationPreview(nodeId, 'tillHere')}
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
