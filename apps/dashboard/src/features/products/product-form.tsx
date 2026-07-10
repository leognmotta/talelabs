import type { Product } from '@talelabs/sdk'
import type { ProductFormValues } from './product-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { IconArrowLeft } from '@tabler/icons-react'
import { Button, buttonVariants } from '@talelabs/ui/components/button'
import { Field, FieldError, FieldLabel } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import {
  NativeSelect,
  NativeSelectOption,
} from '@talelabs/ui/components/native-select'
import { Textarea } from '@talelabs/ui/components/textarea'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useBrandOptions } from '../brands/use-brand-options'
import { ProductListField } from './product-list-field'
import { productFormSchema } from './product-schema'
import {
  useCreateProductMutation,
  useUpdateProductMutation,
} from './products.queries'

export function ProductForm({ product }: { product?: Product }) {
  const navigate = useNavigate()
  const brands = useBrandOptions()
  const create = useCreateProductMutation()
  const update = useUpdateProductMutation(product?.id ?? '')
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? '',
      brandId: product?.brandId ?? '',
      description: product?.description ?? '',
      features: product?.features.map(value => ({ value })) ?? [],
      benefits: product?.benefits.map(value => ({ value })) ?? [],
    },
  })
  const cancel = product ? `/products/${product.id}` : '/products'
  async function submit(values: ProductFormValues) {
    try {
      const data = {
        name: values.name.trim(),
        brandId: values.brandId || undefined,
        description: values.description.trim() || undefined,
        features: values.features.map(item => item.value.trim()),
        benefits: values.benefits.map(item => item.value.trim()),
      }
      const saved = product
        ? await update.mutateAsync({
            ...data,
            brandId: data.brandId ?? null,
            description: data.description ?? null,
          })
        : await create.mutateAsync(data)
      toast.success(product ? 'Product updated' : 'Product created')
      navigate(`/products/${saved.id}`, { replace: true })
    }
    catch (error) {
      form.setError('root', {
        message: getApiErrorMessage(error, 'Could not save product.'),
      })
    }
  }
  return (
    <div
      className="
        mx-auto w-full max-w-3xl p-5
        md:p-8
      "
    >
      <header className="flex items-center gap-3 pb-6">
        <Link
          aria-label="Back"
          className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
          to={cancel}
        >
          <IconArrowLeft />
        </Link>
        <h1 className="text-lg font-semibold">
          {product ? 'Edit product' : 'New product'}
        </h1>
      </header>
      <form
        className="flex flex-col gap-6"
        onSubmit={form.handleSubmit(submit)}
      >
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Name</FieldLabel>
              <Input {...field} autoFocus />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="brandId"
          render={({ field }) => (
            <Field>
              <FieldLabel>Brand</FieldLabel>
              <NativeSelect {...field}>
                <NativeSelectOption value="">
                  Standalone product
                </NativeSelectOption>
                {brands.data?.data.map(brand => (
                  <NativeSelectOption key={brand.id} value={brand.id}>
                    {brand.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="description"
          render={({ field }) => (
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea {...field} rows={4} />
            </Field>
          )}
        />
        <ProductListField
          control={form.control}
          label="Features"
          name="features"
          register={form.register}
        />
        <ProductListField
          control={form.control}
          label="Benefits"
          name="benefits"
          register={form.register}
        />
        {form.formState.errors.root && (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        )}
        <div className="flex justify-end gap-2">
          <Link className={buttonVariants({ variant: 'outline' })} to={cancel}>
            Cancel
          </Link>
          <Button disabled={form.formState.isSubmitting} type="submit">
            Save product
          </Button>
        </div>
      </form>
    </div>
  )
}
