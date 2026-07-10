import type { ComponentType } from 'react'

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@talelabs/ui/components/empty'

export function ContextEmptyState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode
  description?: string
  icon: ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <Empty className="min-h-72 rounded-none border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  )
}
