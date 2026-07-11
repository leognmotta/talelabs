import type { ComponentType, ReactNode } from 'react'

import { IconArrowLeft } from '@tabler/icons-react'
import { buttonVariants } from '@talelabs/ui/components/button'
import { cn } from '@talelabs/ui/lib/utils'
import { Link } from 'react-router'
import { ElementCreateSectionNavigation } from './element-create-section-navigation'

export function ElementEditorLayout({
  backLabel,
  backTo,
  children,
  description,
  icon: Icon,
  title,
}: {
  backLabel: string
  backTo: string
  children: ReactNode
  description: string
  icon: ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <section className="min-h-[calc(100svh-4rem)] bg-background">
      <header className="border-b bg-background">
        <div
          className="
            mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5
            sm:px-6
          "
        >
          <Link
            className={cn(
              buttonVariants({ size: 'sm', variant: 'ghost' }),
              'w-fit',
            )}
            to={backTo}
          >
            <IconArrowLeft data-icon="inline-start" />
            {backLabel}
          </Link>
          <div className="flex items-start gap-4">
            <div
              className="
                flex size-11 shrink-0 items-center justify-center rounded-2xl
                border bg-card
              "
            >
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                {title}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div
        className="
          mx-auto grid w-full max-w-6xl gap-6 px-4 py-6
          sm:px-6
          lg:grid-cols-[14rem_minmax(0,1fr)]
        "
      >
        <ElementCreateSectionNavigation />
        {children}
      </div>
    </section>
  )
}
