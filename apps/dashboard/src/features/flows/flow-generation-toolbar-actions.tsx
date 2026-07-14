import { IconChevronDown } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
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
  const running = canvas.getGenerationPreview(nodeId)?.status === 'pending'
  const disabled = !canRun || running

  return (
    <div className="flex items-stretch" data-flow-run-actions>
      <FlowActionTooltip disabled={disabled} label={label}>
        <Button
          className="rounded-r-none border-r-primary-foreground/20"
          disabled={disabled}
          size="sm"
          type="button"
          onClick={() => void canvas.runGenerationPreview(nodeId)}
        >
          {label}
        </Button>
      </FlowActionTooltip>
      <DropdownMenu>
        <FlowActionTooltip label={optionsLabel}>
          <DropdownMenuTrigger
            render={(
              <Button
                aria-label={optionsLabel}
                className="rounded-l-none border-l-0"
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
          <DropdownMenuItem
            className="items-start py-3"
            disabled
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
            disabled
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
