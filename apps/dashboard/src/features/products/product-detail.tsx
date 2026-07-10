import { IconPackage } from '@tabler/icons-react'
import { useGetProduct } from '@talelabs/sdk'
import { useParams } from 'react-router'
import { useBrandOptions } from '../brands/use-brand-options'
import { ContextDetailHeader } from '../context/context-detail-header'
import { ContextDetailLoading } from '../context/context-detail-loading'
import { ContextEmptyState } from '../context/context-empty-state'
import { ContextProfileField } from '../context/context-profile-field'
import { DeleteResourceDialog } from '../context/delete-resource-dialog'
import { useContextResourceDelete } from '../context/use-context-resource-delete'
import { useDeleteProductMutation } from './products.queries'

export function ProductDetail() {
  const { productId } = useParams()
  const query = useGetProduct({ productId })
  const brands = useBrandOptions()
  const mutation = useDeleteProductMutation(productId ?? '')
  const deletion = useContextResourceDelete({
    deleteResource: () => mutation.mutateAsync(),
    errorMessage: 'Could not delete product.',
    returnTo: '/products',
    successMessage: 'Product deleted',
  })
  if (query.isPending)
    return <ContextDetailLoading />
  if (!query.data)
    return <ContextEmptyState icon={IconPackage} title="Product unavailable" />
  const product = query.data
  const brand = brands.data?.data.find(item => item.id === product.brandId)
  return (
    <article>
      <ContextDetailHeader
        backTo="/products"
        deleteLabel="Delete product"
        editTo={`/products/${product.id}/edit`}
        onDelete={() => deletion.setIsOpen(true)}
        subtitle={brand?.name ?? 'Standalone product'}
        title={product.name}
      />
      <div
        className="
          grid gap-8 p-5
          md:grid-cols-2 md:p-8
        "
      >
        <ContextProfileField label="Description" value={product.description} />
        <section>
          <h2 className="text-sm font-medium">Product kit</h2>
          <p className="mt-2 text-sm text-muted-foreground">No assets linked</p>
        </section>
        <section>
          <h2 className="text-sm font-medium">Features</h2>
          <ul className="mt-2 list-disc pl-5 text-sm/6 text-muted-foreground">
            {product.features.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-medium">Benefits</h2>
          <ul className="mt-2 list-disc pl-5 text-sm/6 text-muted-foreground">
            {product.benefits.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
      <DeleteResourceDialog
        description={`Delete “${product.name}”?`}
        isPending={mutation.isPending}
        onConfirm={() => void deletion.confirmDelete()}
        onOpenChange={deletion.setIsOpen}
        open={deletion.isOpen}
        title="Delete product"
      />
    </article>
  )
}
