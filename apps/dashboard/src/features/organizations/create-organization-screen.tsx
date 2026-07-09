import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@talelabs/ui/components/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { slugify } from '../../shared/lib/slugify'

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Enter an organization name.'),
  slug: z.string().trim().min(1, 'Enter a workspace slug.'),
})

type CreateOrganizationFormValues = z.infer<typeof createOrganizationSchema>

export function CreateOrganizationScreen({
  onCreateOrganization,
  onSignOut,
}: {
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  onSignOut: () => Promise<void>
}) {
  const form = useForm<CreateOrganizationFormValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form

  async function handleCreateOrganization(values: CreateOrganizationFormValues) {
    form.clearErrors('root.serverError')

    try {
      const error = await onCreateOrganization(
        values.name.trim(),
        slugify(values.slug || values.name),
      )

      if (error) {
        form.setError('root.serverError', {
          message: error,
          type: 'server',
        })
      }
    }
    catch {
      form.setError('root.serverError', {
        message: 'Could not create organization.',
        type: 'server',
      })
    }
  }

  return (
    <main className="
      flex min-h-screen items-center justify-center bg-background px-6 py-8
      text-foreground
    "
    >
      <section className="
        w-full max-w-md rounded-lg border border-border bg-card p-6
        text-card-foreground shadow-lg
      "
      >
        <form
          className="flex flex-col gap-5"
          onSubmit={form.handleSubmit(handleCreateOrganization)}
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">TaleLabs</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Create your organization
            </h1>
            <p className="text-sm text-muted-foreground">
              Your account is ready. Create a workspace to keep projects,
              members, and data scoped to an organization.
            </p>
          </div>

          <FieldGroup>
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="create-organization-name">
                    Organization name
                  </FieldLabel>
                  <Input
                    {...field}
                    id="create-organization-name"
                    placeholder="Acme Inc."
                    aria-invalid={fieldState.invalid}
                    onChange={(event) => {
                      const nextName = event.target.value
                      field.onChange(nextName)
                      form.setValue('slug', slugify(nextName), {
                        shouldDirty: true,
                      })
                    }}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="slug"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="create-organization-slug">
                    Workspace slug
                  </FieldLabel>
                  <Input
                    {...field}
                    id="create-organization-slug"
                    placeholder="acme-inc"
                    aria-invalid={fieldState.invalid}
                    onChange={(event) => {
                      field.onChange(slugify(event.target.value))
                    }}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>

          {errors.root?.serverError && (
            <FieldError>
              {errors.root.serverError.message}
            </FieldError>
          )}

          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create organization'}
          </Button>

          <Button type="button" variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        </form>
      </section>
    </main>
  )
}
