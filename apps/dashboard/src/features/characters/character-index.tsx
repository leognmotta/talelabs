import { IconUserStar } from '@tabler/icons-react'
import { ContextEmptyState } from '../context/context-empty-state'

export function CharacterIndex() {
  return (
    <ContextEmptyState
      description="Select a character to view its profile."
      icon={IconUserStar}
      title="Character profile"
    />
  )
}
