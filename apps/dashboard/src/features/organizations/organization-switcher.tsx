import { zodResolver } from '@hookform/resolvers/zod'
import {
  IconBuilding,
  IconPlus,
  IconSelector,
} from '@tabler/icons-react'
import { listOrganizationsQueryKey, useListOrganizations } from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@talelabs/ui/components/sidebar'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { slugify } from '../../shared/lib/slugify'

interface OrganizationSummary {
  id: string
  isSystemAdminAccess: boolean
  name: string
  slug: string
}

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Enter an organization name.'),
  slug: z.string().trim().min(1, 'Enter a workspace slug.'),
})

type CreateOrganizationFormValues = z.infer<typeof createOrganizationSchema>

export function OrganizationSwitcher({
  activeOrganizationId,
  onCreateOrganization,
  onDropdownOpenChange,
  onSwitchOrganization,
}: {
  activeOrganizationId: string | null
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  onDropdownOpenChange: (open: boolean) => void
  onSwitchOrganization: (organizationId: string) => Promise<string | null>
}) {
  const { isMobile } = useSidebar()
  const queryClient = useQueryClient()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isSwitchingId, setIsSwitchingId] = useState<string | null>(null)
  const createOrganizationForm = useForm<CreateOrganizationFormValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: '',
      slug: '',
    },
  })
  const {
    control,
    formState: {
      errors: createOrganizationErrors,
      isSubmitting: isCreating,
    },
  } = createOrganizationForm
  const organizationsQuery = useListOrganizations()
  const organizations = useMemo<OrganizationSummary[]>(() => {
    return organizationsQuery.data?.organizations ?? []
  }, [organizationsQuery.data])

  const activeOrganization = useMemo(() => {
    return organizations.find(organization => organization.id === activeOrganizationId)
  }, [activeOrganizationId, organizations])

  async function handleSwitchOrganization(organizationId: string) {
    if (organizationId === activeOrganizationId)
      return

    setIsSwitchingId(organizationId)

    const switchError = await onSwitchOrganization(organizationId)

    setIsSwitchingId(null)

    if (switchError)
      toast.error(switchError)
  }

  async function handleCreateOrganization(values: CreateOrganizationFormValues) {
    createOrganizationForm.clearErrors('root.serverError')

    try {
      const createError = await onCreateOrganization(
        values.name.trim(),
        slugify(values.slug || values.name),
      )

      if (createError) {
        createOrganizationForm.setError('root.serverError', {
          message: createError,
          type: 'server',
        })
        return
      }

      createOrganizationForm.reset()
      setIsCreateDialogOpen(false)
      await queryClient.invalidateQueries({
        queryKey: listOrganizationsQueryKey(),
      })
    }
    catch {
      createOrganizationForm.setError('root.serverError', {
        message: 'Could not create organization.',
        type: 'server',
      })
    }
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu onOpenChange={onDropdownOpenChange}>
            <DropdownMenuTrigger
              render={(
                <SidebarMenuButton
                  size="lg"
                  className="
                    data-[state=open]:bg-sidebar-accent
                    data-[state=open]:text-sidebar-accent-foreground
                  "
                />
              )}
            >
              <div className="
                flex aspect-square size-8 items-center justify-center rounded-lg
                bg-sidebar-primary text-sidebar-primary-foreground
              "
              >
                <IconBuilding />
              </div>
              <div className="grid flex-1 text-left text-sm/tight">
                <span className="truncate font-medium">
                  {activeOrganization?.name ?? 'TaleLabs'}
                </span>
                <span className="truncate text-xs">
                  {activeOrganization?.isSystemAdminAccess
                    ? 'System admin access'
                    : activeOrganization?.slug ?? 'Select organization'}
                </span>
              </div>
              <IconSelector className="ml-auto" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--anchor-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Organizations
                </DropdownMenuLabel>
                {organizationsQuery.error && (
                  <DropdownMenuItem disabled className="gap-2 p-2">
                    Could not load organizations.
                  </DropdownMenuItem>
                )}
                {organizations.map((organization, index) => (
                  <DropdownMenuItem
                    key={organization.id}
                    className="gap-2 p-2"
                    disabled={isSwitchingId === organization.id}
                    onClick={() => void handleSwitchOrganization(organization.id)}
                  >
                    <div className="
                      flex size-6 items-center justify-center rounded-md border
                    "
                    >
                      <IconBuilding />
                    </div>
                    <span className="truncate">{organization.name}</span>
                    {organization.id === activeOrganizationId && (
                      <DropdownMenuShortcut>Active</DropdownMenuShortcut>
                    )}
                    {organization.id !== activeOrganizationId
                      && organization.isSystemAdminAccess && (
                      <DropdownMenuShortcut>System</DropdownMenuShortcut>
                    )}
                    {organization.id !== activeOrganizationId
                      && !organization.isSystemAdminAccess && (
                      <DropdownMenuShortcut>
                        {index + 1}
                      </DropdownMenuShortcut>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="gap-2 p-2"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <div className="
                    flex size-6 items-center justify-center rounded-md border
                    bg-transparent
                  "
                  >
                    <IconPlus />
                  </div>
                  <div className="font-medium text-muted-foreground">
                    Create organization
                  </div>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
          if (!open) {
            createOrganizationForm.clearErrors()
            createOrganizationForm.reset()
          }
        }}
      >
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={createOrganizationForm.handleSubmit(handleCreateOrganization)}
          >
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>
                Create a workspace for this account before using TaleLabs.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Controller
                name="name"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="organization-name">
                      Organization name
                    </FieldLabel>
                    <Input
                      {...field}
                      id="organization-name"
                      placeholder="Acme Inc"
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => {
                        const nextName = event.target.value
                        field.onChange(nextName)
                        createOrganizationForm.setValue('slug', slugify(nextName), {
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
                    <FieldLabel htmlFor="organization-slug">
                      Workspace slug
                    </FieldLabel>
                    <Input
                      {...field}
                      id="organization-slug"
                      placeholder="acme"
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
            {createOrganizationErrors.root?.serverError && (
              <FieldError>
                {createOrganizationErrors.root.serverError.message}
              </FieldError>
            )}
            <DialogFooter>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create organization'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
