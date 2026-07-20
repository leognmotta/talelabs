/** Quiet empty-state presentation shared by generation preview stages. */

import type { ComponentType } from 'react'

/**
 * Renders the standardized empty preview content: a muted family icon plus the
 * node's current readiness hint, so an idle node explains its next step
 * without adding chrome.
 */
export function GenerationPreviewEmptyState({
  icon: Icon,
  message,
}: {
  icon: ComponentType<{ className?: string, stroke?: number }>
  /** Localized readiness hint; omit to render the icon alone. */
  message?: string
}) {
  return (
    <div
      className="
        flex flex-col items-center justify-center gap-2 px-6 text-center
      "
    >
      <Icon aria-hidden className="size-8 text-foreground/25" stroke={1.25} />
      {message
        ? (
            <span className="text-[11px] text-muted-foreground">
              {message}
            </span>
          )
        : null}
    </div>
  )
}
