import type { FormEvent } from 'react'

import { Button } from '@talelabs/ui/components/button'
import { useState } from 'react'

import { slugify } from '../../shared/lib/slugify'

export function CreateOrganizationScreen({
  onCreateOrganization,
  onSignOut,
}: {
  onCreateOrganization: (name: string, slug: string) => Promise<string | null>
  onSignOut: () => Promise<void>
}) {
  const [organizationName, setOrganizationName] = useState('')
  const [organizationSlug, setOrganizationSlug] = useState('')
  const [organizationError, setOrganizationError] = useState<string | null>(null)
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false)

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOrganizationError(null)

    const trimmedName = organizationName.trim()
    const slug = slugify(organizationSlug || organizationName)

    if (!trimmedName || !slug) {
      setOrganizationError('Enter an organization name.')
      return
    }

    setIsCreatingOrganization(true)

    const error = await onCreateOrganization(trimmedName, slug)

    setIsCreatingOrganization(false)

    if (error)
      setOrganizationError(error)
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
        <form className="flex flex-col gap-5" onSubmit={handleCreateOrganization}>
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

          <label className="flex flex-col gap-2 text-sm font-medium">
            Organization name
            <input
              className="
                h-10 rounded-lg border border-input bg-background px-3 text-sm
                transition-shadow outline-none
                focus-visible:ring-3 focus-visible:ring-ring/50
              "
              value={organizationName}
              onChange={(event) => {
                const nextName = event.target.value
                setOrganizationName(nextName)
                setOrganizationSlug(slugify(nextName))
              }}
              placeholder="Acme Inc."
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Workspace slug
            <input
              className="
                h-10 rounded-lg border border-input bg-background px-3 text-sm
                transition-shadow outline-none
                focus-visible:ring-3 focus-visible:ring-ring/50
              "
              value={organizationSlug}
              onChange={event => setOrganizationSlug(slugify(event.target.value))}
              placeholder="acme-inc"
              required
            />
          </label>

          {organizationError && (
            <p className="
              rounded-lg border border-destructive/30 bg-destructive/10 px-3
              py-2 text-sm text-destructive
            "
            >
              {organizationError}
            </p>
          )}

          <Button type="submit" size="lg" disabled={isCreatingOrganization}>
            {isCreatingOrganization ? 'Creating...' : 'Create organization'}
          </Button>

          <Button type="button" variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        </form>
      </section>
    </main>
  )
}
