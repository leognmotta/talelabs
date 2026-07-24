/** Quiet secondary action used by the first-use Project Home launchpad. */

import type { ReactNode } from 'react'

import { IconArrowRight } from '@tabler/icons-react'
import { Link } from 'react-router'

/** Renders one linked or imperative Project setup action. */
export function ProjectHomeEmptyAction({
  description,
  disabled = false,
  icon,
  label,
  onClick,
  to,
  widthClassName,
}: {
  /** Localized explanation of the outcome. */
  description: string
  /** Prevents an imperative action until its destination is resolved. */
  disabled?: boolean
  /** Domain icon for the action. */
  icon: ReactNode
  /** Localized action title. */
  label: string
  /** Executes an imperative action when no route is supplied. */
  onClick?: () => void
  /** Optional route for a navigational action. */
  to?: string
  /** Responsive edge spacing for the launchpad grid position. */
  widthClassName: string
}) {
  const content = (
    <>
      <span className="flex min-w-0 flex-1 gap-3">
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">
            {label}
          </span>
          <span className="
            mt-1 block max-w-64 text-xs/relaxed text-muted-foreground
          "
          >
            {description}
          </span>
        </span>
      </span>
      <IconArrowRight className="
        size-4 shrink-0 text-muted-foreground transition-transform
        group-hover:translate-x-0.5 group-hover:text-foreground
      "
      />
    </>
  )
  const className = `
    ${widthClassName}
    group flex min-h-24 w-full items-start gap-4 px-4 py-5 text-left
    transition-colors outline-none
    hover:bg-muted/45
    focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset
    active:translate-y-px
    disabled:pointer-events-none disabled:opacity-45
  `

  return to
    ? (
        <Link className={className} to={to}>
          {content}
        </Link>
      )
    : (
        <button
          className={className}
          disabled={disabled}
          type="button"
          onClick={onClick}
        >
          {content}
        </button>
      )
}
