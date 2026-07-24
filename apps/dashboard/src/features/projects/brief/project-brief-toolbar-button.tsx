/** Accessible formatting command used by the Project Brief toolbar. */

import type { ReactNode } from 'react'

import { Button } from '@talelabs/ui/components/button'

/** Renders one active, disabled, or available Brief editor command. */
export function ProjectBriefToolbarButton({
  active = false,
  disabled = false,
  label,
  onClick,
  children,
}: {
  /** Whether the command currently applies to the editor selection. */
  active?: boolean
  /** Icon or compact command mark presented inside the button. */
  children: ReactNode
  /** Whether the editor can currently execute the command. */
  disabled?: boolean
  /** Localized accessible and hover label. */
  label: string
  /** Executes the formatting command against the active editor. */
  onClick: () => void
}) {
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      size="icon-sm"
      title={label}
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
