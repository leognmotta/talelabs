import type { Character } from '@talelabs/sdk'
import type { CharacterFormValues } from './character-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { IconArrowLeft } from '@tabler/icons-react'
import { Button, buttonVariants } from '@talelabs/ui/components/button'
import { Checkbox } from '@talelabs/ui/components/checkbox'
import { Field, FieldError, FieldLabel } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Textarea } from '@talelabs/ui/components/textarea'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { useBrandOptions } from '../brands/use-brand-options'
import { toNullableText } from '../context/context-form-values'
import { characterFormSchema } from './character-schema'
import {
  useCreateCharacterMutation,
  useUpdateCharacterMutation,
} from './characters.queries'

export function CharacterForm({ character }: { character?: Character }) {
  const navigate = useNavigate()
  const brands = useBrandOptions()
  const create = useCreateCharacterMutation()
  const update = useUpdateCharacterMutation(character?.id ?? '')
  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: {
      name: character?.name ?? '',
      role: character?.role ?? '',
      description: character?.description ?? '',
      personality: character?.personality ?? '',
      visualNotes: character?.visualNotes ?? '',
      brandIds: character?.brandIds ?? [],
    },
  })
  const cancel = character ? `/characters/${character.id}` : '/characters'
  async function submit(values: CharacterFormValues) {
    try {
      const profile = {
        name: values.name.trim(),
        role: toNullableText(values.role),
        description: toNullableText(values.description),
        personality: toNullableText(values.personality),
        visualNotes: toNullableText(values.visualNotes),
      }
      const saved = character
        ? await update.mutateAsync({
            ...profile,
            brandIds: values.brandIds,
          })
        : await create.mutateAsync({
            ...profile,
            role: profile.role ?? undefined,
            description: profile.description ?? undefined,
            personality: profile.personality ?? undefined,
            visualNotes: profile.visualNotes ?? undefined,
            brandIds: values.brandIds,
          })
      toast.success(character ? 'Character updated' : 'Character created')
      navigate(`/characters/${saved.id}`, { replace: true })
    }
    catch (error) {
      form.setError('root', {
        message: getApiErrorMessage(error, 'Could not save character.'),
      })
    }
  }
  const textareas = [
    { name: 'description', label: 'Description' },
    { name: 'personality', label: 'Personality' },
    { name: 'visualNotes', label: 'Visual notes' },
  ] as const
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
          {character ? 'Edit character' : 'New character'}
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
          name="role"
          render={({ field }) => (
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Input {...field} placeholder="Spokesperson, mascot, customer" />
            </Field>
          )}
        />
        {textareas.map(item => (
          <Controller
            control={form.control}
            key={item.name}
            name={item.name}
            render={({ field }) => (
              <Field>
                <FieldLabel>{item.label}</FieldLabel>
                <Textarea {...field} rows={4} />
              </Field>
            )}
          />
        ))}
        <Controller
          control={form.control}
          name="brandIds"
          render={({ field }) => (
            <Field>
              <FieldLabel>Brands</FieldLabel>
              <div
                className="
                  grid gap-2
                  sm:grid-cols-2
                "
              >
                {brands.data?.data.map(brand => (
                  <label
                    className="
                      flex items-center gap-3 rounded-lg border p-3 text-sm
                    "
                    key={brand.id}
                  >
                    <Checkbox
                      checked={field.value.includes(brand.id)}
                      onCheckedChange={checked =>
                        field.onChange(
                          checked
                            ? [...field.value, brand.id]
                            : field.value.filter(id => id !== brand.id),
                        )}
                    />
                    {brand.name}
                  </label>
                ))}
              </div>
            </Field>
          )}
        />
        {form.formState.errors.root && (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        )}
        <div className="flex justify-end gap-2">
          <Link className={buttonVariants({ variant: 'outline' })} to={cancel}>
            Cancel
          </Link>
          <Button disabled={form.formState.isSubmitting} type="submit">
            Save character
          </Button>
        </div>
      </form>
    </div>
  )
}
