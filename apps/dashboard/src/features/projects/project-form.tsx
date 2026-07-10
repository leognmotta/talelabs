import type { Project } from '@talelabs/sdk'
import type { ProjectFormValues } from './project-schema'

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
import { toNullableText, toOptionalText } from '../context/context-form-values'
import { projectFormSchema } from './project-schema'
import {
  useCreateProjectMutation,
  useUpdateProjectMutation,
} from './projects.queries'

export function ProjectForm({ project }: { project?: Project }) {
  const navigate = useNavigate()
  const createMutation = useCreateProjectMutation()
  const updateMutation = useUpdateProjectMutation(project?.id ?? '')
  const isEditing = Boolean(project)
  const form = useForm<ProjectFormValues>({
    defaultValues: {
      description: project?.description ?? '',
      name: project?.name ?? '',
    },
    mode: 'onSubmit',
    resolver: zodResolver(projectFormSchema),
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form
  const cancelHref = project ? `/projects/${project.id}` : '/projects'

  async function handleSubmit(values: ProjectFormValues) {
    form.clearErrors('root.serverError')

    try {
      const name = values.name.trim()
      const savedProject = project
        ? await updateMutation.mutateAsync({
            description: toNullableText(values.description),
            name,
          })
        : await createMutation.mutateAsync({
            description: toOptionalText(values.description),
            name,
          })

      toast.success(project ? 'Project updated' : 'Project created')
      navigate(`/projects/${savedProject.id}`, { replace: true })
    }
    catch (error) {
      form.setError('root.serverError', {
        message: getApiErrorMessage(error, 'Could not save project.'),
        type: 'server',
      })
    }
  }

  return (
    <div className="
      mx-auto w-full max-w-2xl p-5
      md:px-8 md:py-7
    "
    >
      <header className="flex items-center gap-3 pb-5">
        <Link
          aria-label="Back"
          className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
          to={cancelHref}
        >
          <IconArrowLeft />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">
            {isEditing ? 'Edit project' : 'New project'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditing ? project?.name : 'Add reusable context for your work.'}
          </p>
        </div>
      </header>
      <Separator />
      <form className="flex flex-col gap-6 pt-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <FieldGroup>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="project-name">Name</FieldLabel>
                <Input
                  {...field}
                  aria-invalid={fieldState.invalid}
                  autoFocus
                  id="project-name"
                  maxLength={160}
                  placeholder="Campaign name"
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="project-description">Description</FieldLabel>
                <Textarea
                  {...field}
                  aria-invalid={fieldState.invalid}
                  id="project-description"
                  maxLength={4000}
                  placeholder="Optional context"
                  rows={6}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
        {errors.root?.serverError && (
          <FieldError>{errors.root.serverError.message}</FieldError>
        )}
        <div className="flex justify-end gap-2">
          <Link className={buttonVariants({ variant: 'outline' })} to={cancelHref}>
            Cancel
          </Link>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Saving...' : 'Save project'}
          </Button>
        </div>
      </form>
    </div>
  )
}
