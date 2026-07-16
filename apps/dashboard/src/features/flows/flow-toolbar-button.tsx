/** Accessible icon-button primitive used by canvas and node toolbars. */

import type { IconLock } from '@tabler/icons-react'

import { Button } from '@talelabs/ui/components/button'
import { Spinner } from '@talelabs/ui/components/spinner'
import { cn } from '@talelabs/ui/lib/utils'
import { FlowActionTooltip } from './flow-action-tooltip'

/** Renders an accessible tooltip-wrapped icon action for Flow toolbars. */
export function FlowToolbarButton({
  disabled = false,
  icon: Icon,
  label,
  loading = false,
  pressed,
  shortcut,
  tone = 'default',
  onClick,
}: {
  disabled?: boolean
  icon: typeof IconLock
  label: string
  loading?: boolean
  onClick?: () => void
  pressed?: boolean
  shortcut?: string
  tone?: 'default' | 'warning'
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
        className={cn(
          tone === 'warning' && pressed
          && `
            bg-warning text-warning-foreground
            hover:bg-warning/90 hover:text-warning-foreground
          `,
        )}
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
