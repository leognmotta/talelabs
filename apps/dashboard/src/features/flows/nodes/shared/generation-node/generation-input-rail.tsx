/** Ordered rail of typed input handles derived from the active model contract. */

import type { ComponentProps, ReactNode } from 'react'

/** Positions typed input handles beside the common generation node frame. */
export function GenerationInputRail({
  ariaLabel,
  children,
  ...props
}: Omit<ComponentProps<'div'>, 'children'> & {
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <div
      {...props}
      aria-label={ariaLabel}
      className="
        absolute top-1/2 left-0 z-20 flex -translate-y-1/2 flex-col gap-1
      "
      data-generation-input-rail
      role="group"
    >
      {children}
    </div>
  )
}
