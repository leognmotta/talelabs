import type { ReactNode } from 'react'

export function SettingsRow({
  children,
  description,
  label,
}: {
  children: ReactNode
  description?: string
  label: string
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
