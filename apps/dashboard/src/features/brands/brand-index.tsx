import { IconPalette } from '@tabler/icons-react'
import { ContextEmptyState } from '../context/context-empty-state'

export function BrandIndex() {
  return (
    <ContextEmptyState
      description="Select a brand to view its profile."
      icon={IconPalette}
      title="Brand profile"
    />
  )
}
