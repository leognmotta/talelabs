import { IconUserStar } from '@tabler/icons-react'
import { useGetCharacter } from '@talelabs/sdk'
import { useParams } from 'react-router'
import { ContextResourceEditor } from '../context/context-resource-editor'
import { CharacterForm } from './character-form'

export function CharacterEditor() {
  const { characterId } = useParams()
  const query = useGetCharacter({ characterId })
  if (!characterId)
    return <CharacterForm />
  return (
    <ContextResourceEditor
      data={query.data}
      icon={IconUserStar}
      isPending={query.isPending}
      render={character => <CharacterForm character={character} />}
      unavailableTitle="Character unavailable"
    />
  )
}
