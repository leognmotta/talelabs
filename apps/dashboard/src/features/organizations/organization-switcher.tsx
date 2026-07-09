import type { FormEvent } from 'react'

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

import { slugify } from '../../shared/lib/slugify'

interface OrganizationSummary {
  id: string
  isSystemAdminAccess: boolean
  name: string
  slug: string
}

export function OrganizationSwitcher({
  activeOrganizationId,
  onCreateOrganization,
  onSwitchOrganization,
}: {
  activeOrganizationId: string | null
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  onSwitchOrganization: (organizationId: string) => Promise<string | null>
}) {
  const { isMobile } = useSidebar()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isSwitchingId, setIsSwitchingId] = useState<string | null>(null)
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

    setError(null)
    setIsSwitchingId(organizationId)

    const switchError = await onSwitchOrganization(organizationId)

    setIsSwitchingId(null)

    if (switchError)
      setError(switchError)
  }

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const nextSlug = slugify(slug || name)

    if (!trimmedName || !nextSlug) {
      setError('Enter an organization name.')
      return
    }

    setIsCreating(true)

    const createError = await onCreateOrganization(trimmedName, nextSlug)

    setIsCreating(false)

    if (createError) {
      setError(createError)
      return
    }

    setName('')
    setSlug('')
    setIsCreateDialogOpen(false)
    await queryClient.invalidateQueries({ queryKey: listOrganizationsQueryKey() })
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
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
          if (!open)
            setError(null)
        }}
      >
        <DialogContent>
          <form className="flex flex-col gap-4" onSubmit={handleCreateOrganization}>
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>
                Create a workspace for this account before using TaleLabs.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="organization-name">
                  Organization name
                </FieldLabel>
                <Input
                  id="organization-name"
                  value={name}
                  onChange={(event) => {
                    const nextName = event.target.value
                    setName(nextName)
                    setSlug(slugify(nextName))
                  }}
                  placeholder="Acme Inc"
                  aria-invalid={!!error}
                />
              </Field>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="organization-slug">
                  Workspace slug
                </FieldLabel>
                <Input
                  id="organization-slug"
                  value={slug}
                  onChange={event => setSlug(slugify(event.target.value))}
                  placeholder="acme"
                  aria-invalid={!!error}
                />
                <FieldError>{error}</FieldError>
              </Field>
            </FieldGroup>
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
