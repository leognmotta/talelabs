import { IconPackage } from '@tabler/icons-react'
import { ContextEmptyState } from '../context/context-empty-state'

export function ProductIndex() {
  return (
    <ContextEmptyState
      description="Select a product to view its profile."
      icon={IconPackage}
      title="Product profile"
    />
  )
}
