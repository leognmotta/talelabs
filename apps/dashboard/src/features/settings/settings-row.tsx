/** Shared layout for one labeled Settings control row. */

import type { ReactNode } from 'react'

/** Aligns a Settings label and optional description with its controls. */
export function SettingsRow({
  children,
  description,
  label,
}: {
  children: ReactNode
  description?: string
  label: ReactNode
}) {
  return (
    <div className="
      grid gap-3 py-4
      sm:grid-cols-[minmax(9rem,13rem)_1fr] sm:items-center
    "
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="
        flex min-w-0 justify-start
        sm:justify-end
      "
      >
        {children}
      </div>
    </div>
  )
}
