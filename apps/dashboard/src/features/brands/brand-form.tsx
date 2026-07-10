import type { Brand } from '@talelabs/sdk'
import type { BrandFormValues } from './brand-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { IconArrowLeft } from '@tabler/icons-react'
import { Button, buttonVariants } from '@talelabs/ui/components/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Separator } from '@talelabs/ui/components/separator'
import { Textarea } from '@talelabs/ui/components/textarea'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { toOptionalText } from '../context/context-form-values'
import { BrandColorsField } from './brand-colors-field'
import { brandFormSchema } from './brand-schema'
import {
  useCreateBrandMutation,
  useUpdateBrandMutation,
} from './brands.queries'

export function BrandForm({ brand }: { brand?: Brand }) {
  const navigate = useNavigate()
  const create = useCreateBrandMutation()
  const update = useUpdateBrandMutation(brand?.id ?? '')
  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      name: brand?.name ?? '',
      description: brand?.description ?? '',
      toneOfVoice: brand?.toneOfVoice ?? '',
      visualStyle: brand?.visualStyle ?? '',
      doRules: brand?.doRules ?? '',
      dontRules: brand?.dontRules ?? '',
      colors: brand?.colors ?? [],
    },
  })
  const cancel = brand ? `/brands/${brand.id}` : '/brands'
  async function submit(values: BrandFormValues) {
    try {
      const data = {
        name: values.name.trim(),
        description: toOptionalText(values.description),
        toneOfVoice: toOptionalText(values.toneOfVoice),
        visualStyle: toOptionalText(values.visualStyle),
        doRules: toOptionalText(values.doRules),
        dontRules: toOptionalText(values.dontRules),
        colors: values.colors.map(color => ({
          name: color.name.trim(),
          hex: color.hex.toUpperCase(),
        })),
      }
      const saved = brand
        ? await update.mutateAsync({
            ...data,
            description: data.description ?? null,
            toneOfVoice: data.toneOfVoice ?? null,
            visualStyle: data.visualStyle ?? null,
            doRules: data.doRules ?? null,
            dontRules: data.dontRules ?? null,
          })
        : await create.mutateAsync(data)
      toast.success(brand ? 'Brand updated' : 'Brand created')
      navigate(`/brands/${saved.id}`, { replace: true })
    }
    catch (error) {
      form.setError('root', {
        message: getApiErrorMessage(error, 'Could not save brand.'),
      })
    }
  }
  const textareas = [
    { name: 'description', label: 'Description' },
    { name: 'toneOfVoice', label: 'Tone of voice' },
    { name: 'visualStyle', label: 'Visual style' },
    { name: 'doRules', label: 'Do rules' },
    { name: 'dontRules', label: 'Don\'t rules' },
  ] as const
  return (
    <div
      className="
        mx-auto w-full max-w-3xl p-5
        md:p-8
      "
    >
      <header className="flex items-center gap-3 pb-5">
        <Link
          aria-label="Back"
          className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
          to={cancel}
        >
          <IconArrowLeft />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">
            {brand ? 'Edit brand' : 'New brand'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {brand?.name ?? 'Brand profile'}
          </p>
        </div>
      </header>
      <Separator />
      <form
        className="flex flex-col gap-7 pt-6"
        onSubmit={form.handleSubmit(submit)}
      >
        <FieldGroup>
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="brand-name">Name</FieldLabel>
                <Input {...field} autoFocus id="brand-name" maxLength={160} />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          {textareas.map(item => (
            <Controller
              control={form.control}
              key={item.name}
              name={item.name}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`brand-${item.name}`}>
                    {item.label}
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id={`brand-${item.name}`}
                    rows={item.name === 'description' ? 3 : 4}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          ))}
        </FieldGroup>
        <BrandColorsField control={form.control} register={form.register} />
        {form.formState.errors.root && (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        )}
        <div className="flex justify-end gap-2">
          <Link className={buttonVariants({ variant: 'outline' })} to={cancel}>
            Cancel
          </Link>
          <Button disabled={form.formState.isSubmitting} type="submit">
            {form.formState.isSubmitting ? 'Saving...' : 'Save brand'}
          </Button>
        </div>
      </form>
    </div>
  )
}
