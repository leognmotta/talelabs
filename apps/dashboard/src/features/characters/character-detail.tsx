import { IconUserStar } from '@tabler/icons-react'
import { useGetCharacter } from '@talelabs/sdk'
import { Badge } from '@talelabs/ui/components/badge'
import { useParams } from 'react-router'
import { useBrandOptions } from '../brands/use-brand-options'
import { ContextDetailHeader } from '../context/context-detail-header'
import { ContextDetailLoading } from '../context/context-detail-loading'
import { ContextEmptyState } from '../context/context-empty-state'
import { ContextProfileField } from '../context/context-profile-field'
import { DeleteResourceDialog } from '../context/delete-resource-dialog'
import { useContextResourceDelete } from '../context/use-context-resource-delete'
import { useDeleteCharacterMutation } from './characters.queries'

export function CharacterDetail() {
  const { characterId } = useParams()
  const query = useGetCharacter({ characterId })
  const brands = useBrandOptions()
  const mutation = useDeleteCharacterMutation(characterId ?? '')
  const deletion = useContextResourceDelete({
    deleteResource: () => mutation.mutateAsync(),
    errorMessage: 'Could not delete character.',
    returnTo: '/characters',
    successMessage: 'Character deleted',
  })
  if (query.isPending)
    return <ContextDetailLoading />
  if (!query.data) {
    return (
      <ContextEmptyState icon={IconUserStar} title="Character unavailable" />
    )
  }
  const character = query.data
  const linked
    = brands.data?.data.filter(brand =>
      character.brandIds.includes(brand.id),
    ) ?? []
  const fields = [
    { label: 'Description', value: character.description },
    { label: 'Personality', value: character.personality },
    { label: 'Visual notes', value: character.visualNotes },
  ]
  return (
    <article>
      <ContextDetailHeader
        backTo="/characters"
        deleteLabel="Delete character"
        editTo={`/characters/${character.id}/edit`}
        onDelete={() => deletion.setIsOpen(true)}
        subtitle={character.role || 'Character'}
        title={character.name}
      />
      <div
        className="
          grid gap-8 p-5
          md:grid-cols-2 md:p-8
        "
      >
        {fields.map(field => (
          <ContextProfileField
            key={field.label}
            label={field.label}
            value={field.value}
          />
        ))}
        <section>
          <h2 className="text-sm font-medium">Brands</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {linked.length
              ? (
                  linked.map(brand => (
                    <Badge key={brand.id} variant="outline">
                      {brand.name}
                    </Badge>
                  ))
                )
              : (
                  <span className="text-sm text-muted-foreground">
                    Global character
                  </span>
                )}
          </div>
        </section>
      </div>
      <DeleteResourceDialog
        description={`Delete “${character.name}”?`}
        isPending={mutation.isPending}
        onConfirm={() => void deletion.confirmDelete()}
        onOpenChange={deletion.setIsOpen}
        open={deletion.isOpen}
        title="Delete character"
      />
    </article>
  )
}
