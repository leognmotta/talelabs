import { NavLink } from 'react-router'

export function AuthModeLink({
  children,
  isActive,
  to,
}: {
  children: string
  isActive: boolean
  to: string
}) {
  return (
    <NavLink
      to={to}
      className={`
        h-9 cursor-pointer rounded-md text-center text-sm/9 font-medium
        transition-colors
        ${isActive
      ? 'bg-background text-foreground shadow-sm'
      : `
        text-muted-foreground
        hover:text-foreground
      `}
      `}
    >
      {children}
    </NavLink>
  )
}
