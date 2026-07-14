import type { IconLock } from '@tabler/icons-react'

import { Button } from '@talelabs/ui/components/button'
import { FlowActionTooltip } from './flow-action-tooltip'

export function FlowToolbarButton({
  disabled = false,
  icon: Icon,
  label,
  pressed,
  shortcut,
  onClick,
}: {
  disabled?: boolean
  icon: typeof IconLock
  label: string
  onClick?: () => void
  pressed?: boolean
  shortcut?: string
}) {
  return (
    <FlowActionTooltip
      disabled={disabled}
      label={label}
      shortcut={shortcut}
    >
      <Button
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        size="icon-sm"
        type="button"
        variant={pressed ? 'secondary' : 'ghost'}
        onClick={onClick}
      >
        <Icon />
      </Button>
    </FlowActionTooltip>
  )
}
