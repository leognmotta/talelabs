import { IconFolder } from '@tabler/icons-react'
import { ContextEmptyState } from '../context/context-empty-state'

export function ProjectsIndex() {
  return (
    <ContextEmptyState
      description="Select a project to view its details."
      icon={IconFolder}
      title="Project details"
    />
  )
}
