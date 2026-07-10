import { IconPalette } from '@tabler/icons-react'
import { useGetBrand } from '@talelabs/sdk'
import { Badge } from '@talelabs/ui/components/badge'
import { useParams } from 'react-router'
import { ContextDetailHeader } from '../context/context-detail-header'
import { ContextDetailLoading } from '../context/context-detail-loading'
import { ContextEmptyState } from '../context/context-empty-state'
import { ContextProfileField } from '../context/context-profile-field'
import { DeleteResourceDialog } from '../context/delete-resource-dialog'
import { useContextResourceDelete } from '../context/use-context-resource-delete'
import { useDeleteBrandMutation } from './brands.queries'

export function BrandDetail() {
  const { brandId } = useParams()
  const query = useGetBrand({ brandId })
  const mutation = useDeleteBrandMutation(brandId ?? '')
  const deletion = useContextResourceDelete({
    deleteResource: () => mutation.mutateAsync(),
    errorMessage: 'Could not delete brand.',
    returnTo: '/brands',
    successMessage: 'Brand deleted',
  })
  if (query.isPending)
    return <ContextDetailLoading />
  if (!query.data)
    return <ContextEmptyState icon={IconPalette} title="Brand unavailable" />
  const brand = query.data
  const fields = [
    { label: 'Description', value: brand.description },
    { label: 'Tone of voice', value: brand.toneOfVoice },
    { label: 'Visual style', value: brand.visualStyle },
    { label: 'Do', value: brand.doRules },
    { label: 'Don\'t', value: brand.dontRules },
  ]
  return (
    <article>
      <ContextDetailHeader
        backTo="/brands"
        deleteLabel="Delete brand"
        editTo={`/brands/${brand.id}/edit`}
        onDelete={() => deletion.setIsOpen(true)}
        subtitle="Brand profile"
        title={brand.name}
      />
      <div
        className="
          grid gap-7 p-5
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
          <h2 className="text-sm font-medium">Colors</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {brand.colors.length
              ? (
                  brand.colors.map(color => (
                    <Badge key={`${color.name}-${color.hex}`} variant="outline">
                      <span
                        className="size-3 rounded-full border"
                        style={{ backgroundColor: color.hex }}
                      />
                      {color.name}
                      {' '}
                      {color.hex}
                    </Badge>
                  ))
                )
              : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
          </div>
        </section>
        <section>
          <h2 className="text-sm font-medium">Brand kit</h2>
          <p className="mt-2 text-sm text-muted-foreground">No assets linked</p>
        </section>
      </div>
      <DeleteResourceDialog
        description={`Delete “${brand.name}”? Products will become standalone.`}
        isPending={mutation.isPending}
        onConfirm={() => void deletion.confirmDelete()}
        onOpenChange={deletion.setIsOpen}
        open={deletion.isOpen}
        title="Delete brand"
      />
    </article>
  )
}
