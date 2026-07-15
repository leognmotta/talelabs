import type { IconLock } from '@tabler/icons-react'

import { Button } from '@talelabs/ui/components/button'
import { Spinner } from '@talelabs/ui/components/spinner'
import { FlowActionTooltip } from './flow-action-tooltip'

export function FlowToolbarButton({
  disabled = false,
  icon: Icon,
  label,
  loading = false,
  pressed,
  shortcut,
  onClick,
}: {
  disabled?: boolean
  icon: typeof IconLock
  label: string
  loading?: boolean
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
        aria-busy={loading}
        aria-pressed={pressed}
        disabled={disabled}
        size="icon-sm"
        type="button"
        variant={pressed ? 'secondary' : 'ghost'}
        onClick={onClick}
      >
        {loading
          ? <Spinner aria-hidden="true" />
          : <Icon />}
      </Button>
    </FlowActionTooltip>
  )
}
