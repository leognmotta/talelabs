/** Hover-revealed action cluster overlaid on a node's media surface. */
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import type { ReactNode } from 'react'

/**
 * Positions media commands over a node preview. Visibility is CSS-driven from
 * the owning node shell: hidden at rest, revealed on shell hover, focus-within,
 * or selection (see `[data-flow-preview-actions]` in the shared stylesheet).
 */
export function FlowPreviewActions({
  children,
  label,
}: {
  children: ReactNode
  /** Localized accessible name for the action cluster. */
  label: string
}) {
  return (
    <div
      aria-label={label}
      className="nodrag nopan absolute top-2 right-2 z-10"
      data-flow-preview-actions
      role="toolbar"
    >
      <div
        className="flex items-center gap-0.5 rounded-full p-0.5"
        data-flow-chrome
      >
        {children}
      </div>
    </div>
  )
}
