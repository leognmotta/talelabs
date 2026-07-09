import type { FormEvent } from 'react'

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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronsUpDownIcon,
  GalleryVerticalEndIcon,
  PlusIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { authClient } from '../lib/auth-client'
import { slugify } from '../lib/slugify'

interface OrganizationSummary {
  id: string
  name: string
  slug: string
}

const organizationListQueryKey = ['better-auth', 'organizations'] as const

export function TeamSwitcher({
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
  const organizationsQuery = useQuery({
    queryKey: organizationListQueryKey,
    queryFn: async () => {
      const result = await authClient.organization.list()

      if (result.error)
        throw new Error(result.error.message ?? 'Could not load organizations.')

      return result.data ?? []
    },
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })
  const organizations = useMemo<OrganizationSummary[]>(() => {
    return organizationsQuery.data ?? []
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
    await queryClient.invalidateQueries({ queryKey: organizationListQueryKey })
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="
                  data-[state=open]:bg-sidebar-accent
                  data-[state=open]:text-sidebar-accent-foreground
                "
              >
                <div className="
                  flex aspect-square size-8 items-center justify-center
                  rounded-lg bg-sidebar-primary text-sidebar-primary-foreground
                "
                >
                  <GalleryVerticalEndIcon />
                </div>
                <div className="grid flex-1 text-left text-sm/tight">
                  <span className="truncate font-medium">
                    {activeOrganization?.name ?? 'TaleLabs'}
                  </span>
                  <span className="truncate text-xs">
                    {activeOrganization?.slug ?? 'Select organization'}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="
                w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg
              "
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={4}
            >
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
                    <GalleryVerticalEndIcon />
                  </div>
                  <span className="truncate">{organization.name}</span>
                  {organization.id === activeOrganizationId
                    ? (
                        <DropdownMenuShortcut>Active</DropdownMenuShortcut>
                      )
                    : (
                        <DropdownMenuShortcut>
                          {index + 1}
                        </DropdownMenuShortcut>
                      )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <div className="
                  flex size-6 items-center justify-center rounded-md border
                  bg-transparent
                "
                >
                  <PlusIcon />
                </div>
                <div className="font-medium text-muted-foreground">
                  Create organization
                </div>
              </DropdownMenuItem>
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
