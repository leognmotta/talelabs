/** Shared branded atmosphere for first-use Create surfaces. */

import { cn } from '@talelabs/ui/lib/utils'

/** Renders the non-interactive gradient behind an empty Create composer. */
export function CreateAmbientGradient({
  className,
}: {
  /** Surface-owned placement and dimensions for the ambient field. */
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none', className)}
      style={{
        background: `
          radial-gradient(
            ellipse at 32% 28%,
            color-mix(in oklab, var(--brand-dune) 16%, transparent),
            transparent 42%
          ),
          radial-gradient(
            ellipse at 76% 38%,
            color-mix(in oklab, var(--brand-twilight) 12%, transparent),
            transparent 46%
          ),
          radial-gradient(
            ellipse at 54% 82%,
            color-mix(in oklab, var(--brand-glacier) 7%, transparent),
            transparent 44%
          )
        `,
        maskImage: `
          radial-gradient(
            ellipse 58% 62% at 50% 42%,
            black 20%,
            transparent 88%
          )
        `,
      }}
    />
  )
}
