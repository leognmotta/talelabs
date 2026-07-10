import { IconPalette } from '@tabler/icons-react'
import { useGetBrand } from '@talelabs/sdk'
import { useParams } from 'react-router'
import { ContextResourceEditor } from '../context/context-resource-editor'
import { BrandForm } from './brand-form'

export function BrandEditor() {
  const { brandId } = useParams()
  const query = useGetBrand({ brandId })
  if (!brandId)
    return <BrandForm />
  return (
    <ContextResourceEditor
      data={query.data}
      icon={IconPalette}
      isPending={query.isPending}
      render={brand => <BrandForm brand={brand} />}
      unavailableTitle="Brand unavailable"
    />
  )
}
