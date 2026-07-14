import type { ReactNode } from 'react'

import { Kbd } from '@talelabs/ui/components/kbd'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import { cn } from '@talelabs/ui/lib/utils'

export function FlowActionTooltip({
  children,
  className,
  disabled = false,
  label,
  shortcut,
}: {
  children: ReactNode
  className?: string
  disabled?: boolean
  label: string
  shortcut?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(
          <span
            aria-disabled={disabled || undefined}
            className={cn(
              'inline-flex',
              disabled && 'cursor-not-allowed',
              className,
            )}
          />
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
}
