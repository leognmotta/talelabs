import { cn } from '@talelabs/ui/lib/utils'

const TALELABS_LOGO_SOURCES = {
  full: {
    dark: '/talelabs-logo-on-dark.png',
    light: '/talelabs-logo-on-light.png',
  },
  icon: {
    dark: '/talelabs-icon-on-dark.png',
    light: '/talelabs-icon-on-light.png',
  },
} as const

export function TaleLabsLogo({
  alt = '',
  className,
  variant,
}: {
  alt?: string
  className?: string
  variant: keyof typeof TALELABS_LOGO_SOURCES
}) {
  const sources = TALELABS_LOGO_SOURCES[variant]

  return (
    <span className={cn('relative block shrink-0', className)}>
      <img
        alt={alt}
        className="
          size-full object-contain
          dark:hidden
        "
        draggable={false}
        src={sources.light}
      />
      <img
        alt={alt}
        className="
          hidden size-full object-contain
          dark:block
        "
        draggable={false}
        src={sources.dark}
      />
    </span>
  )
}
