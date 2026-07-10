import type { ComponentType, ReactNode } from 'react'

import { ContextDetailLoading } from './context-detail-loading'
import { ContextEmptyState } from './context-empty-state'

export function ContextResourceEditor<Data>({
  data,
  icon,
  isPending,
  render,
  unavailableTitle,
}: {
  data: Data | undefined
  icon: ComponentType<{ className?: string }>
  isPending: boolean
  render: (data: Data) => ReactNode
  unavailableTitle: string
}) {
  if (isPending)
    return <ContextDetailLoading />

  if (!data)
    return <ContextEmptyState icon={icon} title={unavailableTitle} />

  return render(data)
}
