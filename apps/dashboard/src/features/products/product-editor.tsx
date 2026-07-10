import { IconPackage } from '@tabler/icons-react'
import { useGetProduct } from '@talelabs/sdk'
import { useParams } from 'react-router'
import { ContextResourceEditor } from '../context/context-resource-editor'
import { ProductForm } from './product-form'

export function ProductEditor() {
  const { productId } = useParams()
  const query = useGetProduct({ productId })
  if (!productId)
    return <ProductForm />
  return (
    <ContextResourceEditor
      data={query.data}
      icon={IconPackage}
      isPending={query.isPending}
      render={product => <ProductForm product={product} />}
      unavailableTitle="Product unavailable"
    />
  )
}
