import { ApiError, getMe, useGetMe } from '@connecto/sdk'
import { Button } from '@connecto/ui/components/button'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { authClient, signIn, signOut, signUp, useSession } from './lib/auth-client'

type AuthMode = 'sign-in' | 'sign-up'
type OrganizationStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function App() {
  const session = useSession()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [organizationStatus, setOrganizationStatus] = useState<OrganizationStatus>('idle')
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState('')
  const [organizationSlug, setOrganizationSlug] = useState('')
  const [organizationError, setOrganizationError] = useState<string | null>(null)
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false)

  const isSignedIn = Boolean(session.data?.user)
  const title = mode === 'sign-in' ? 'Sign in' : 'Create account'
  const submitLabel = mode === 'sign-in' ? 'Sign in' : 'Create account'
  const meQuery = useGetMe({
    query: {
      enabled: isSignedIn && organizationStatus === 'ready',
    },
  })
  const activeWorkspaceId = meQuery.data?.activeOrganizationId ?? activeOrganizationId

  const organizationMessage = useMemo(() => {
    if (organizationStatus === 'ready')
      return `Active organization: ${activeWorkspaceId}`

    if (organizationStatus === 'missing')
      return 'Create your organization to start using the workspace.'

    if (organizationStatus === 'error')
      return 'Could not verify organization access.'

    return 'Checking organization access...'
  }, [activeWorkspaceId, organizationStatus])

  const refreshOrganizationSession = useCallback(async () => {
    setOrganizationStatus('loading')

    try {
      const body = await getMe()

      setActiveOrganizationId(body.activeOrganizationId)
      setOrganizationStatus('ready')
    }
    catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setOrganizationStatus('missing')
        setActiveOrganizationId(null)
        return
      }

      setOrganizationStatus('error')
      setActiveOrganizationId(null)
    }
  }, [])

  useEffect(() => {
    if (!isSignedIn)
      return

    let isCurrent = true

    async function loadOrganizationSession() {
      if (isCurrent)
        await refreshOrganizationSession()
    }

    void loadOrganizationSession()

    return () => {
      isCurrent = false
    }
  }, [isSignedIn, refreshOrganizationSession])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = mode === 'sign-in'
      ? await signIn.email({ email, password })
      : await signUp.email({ email, name, password })

    setIsSubmitting(false)

    if (result.error) {
      setError(result.error.message ?? 'Authentication failed')
      return
    }

    await session.refetch()
  }

  async function handleSignOut() {
    await signOut()
    setActiveOrganizationId(null)
    setOrganizationStatus('idle')
    setOrganizationError(null)
    setOrganizationName('')
    setOrganizationSlug('')
    await session.refetch()
  }

  async function handleCreateOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOrganizationError(null)

    const trimmedName = organizationName.trim()
    const slug = slugify(organizationSlug || organizationName)

    if (!trimmedName || !slug) {
      setOrganizationError('Enter an organization name.')
      return
    }

    setIsCreatingOrganization(true)

    const result = await authClient.organization.create({
      name: trimmedName,
      slug,
    })

    if (result.error) {
      setIsCreatingOrganization(false)
      setOrganizationError(result.error.message ?? 'Could not create organization.')
      return
    }

    if (result.data?.id) {
      const activeResult = await authClient.organization.setActive({
        organizationId: result.data.id,
      })

      if (activeResult.error) {
        setIsCreatingOrganization(false)
        setOrganizationError(activeResult.error.message ?? 'Could not activate organization.')
        return
      }
    }

    await session.refetch()
    await refreshOrganizationSession()
    setIsCreatingOrganization(false)
  }

  if (session.isPending) {
    return (
      <main className="
        flex min-h-screen items-center justify-center bg-background px-6
        text-foreground
      "
      >
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </main>
    )
  }

  if (isSignedIn && organizationStatus === 'missing') {
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
              <p className="text-sm font-medium text-muted-foreground">
                Connecto
              </p>
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

            <Button type="button" variant="ghost" onClick={handleSignOut}>
              Sign out
            </Button>
          </form>
        </section>
      </main>
    )
  }

  if (isSignedIn && organizationStatus !== 'ready') {
    return (
      <main className="
        flex min-h-screen items-center justify-center bg-background px-6 py-8
        text-foreground
      "
      >
        <section className="
          flex w-full max-w-md flex-col gap-4 rounded-lg border border-border
          bg-card p-6 text-card-foreground shadow-lg
        "
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              Connecto
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {organizationStatus === 'error'
                ? 'Organization access unavailable'
                : 'Preparing your workspace'}
            </h1>
            <p className="text-sm text-muted-foreground">{organizationMessage}</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </section>
      </main>
    )
  }

  if (isSignedIn) {
    return (
      <main className="min-h-screen bg-background px-6 py-8 text-foreground">
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <header className="
            flex flex-col gap-4 border-b border-border pb-6
            sm:flex-row sm:items-end sm:justify-between
          "
          >
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                Connecto dashboard
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                {session.data?.user.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {session.data?.user.email}
              </p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              Sign out
            </Button>
          </header>

          <section className="
            rounded-lg border border-border bg-card p-5 text-card-foreground
            shadow-sm
          "
          >
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Organization access</p>
              <p className="text-lg font-semibold">{organizationMessage}</p>
              <p className="text-sm text-muted-foreground">
                SDK /me status:
                {' '}
                {meQuery.isFetching ? 'Refreshing' : meQuery.isSuccess ? 'Loaded' : 'Idle'}
              </p>
            </div>
          </section>
        </section>
      </main>
    )
  }

  return (
    <main className="
      flex min-h-screen items-center justify-center bg-background px-6 py-8
      text-foreground
    "
    >
      <section className="
        grid w-full max-w-5xl overflow-hidden rounded-lg border border-border
        bg-card shadow-lg
        md:grid-cols-[1fr_420px]
      "
      >
        <div className="
          flex min-h-[520px] flex-col justify-between bg-muted p-8
        "
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              Connecto
            </p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight">
              Organization-first workspace access
            </h1>
          </div>
          <p className="max-w-lg text-sm text-muted-foreground">
            Personal workspaces are disabled. Accounts must be connected to an
            organization before they can use the dashboard.
          </p>
        </div>

        <form className="flex flex-col gap-5 p-8" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">
              Use your work email to continue.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <button
              type="button"
              className={`
                h-9 cursor-pointer rounded-md text-sm font-medium
                transition-colors
                ${mode === 'sign-in'
      ? 'bg-background text-foreground shadow-sm'
      : `
        text-muted-foreground
        hover:text-foreground
      `}
              `}
              onClick={() => setMode('sign-in')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`
                h-9 cursor-pointer rounded-md text-sm font-medium
                transition-colors
                ${mode === 'sign-up'
      ? 'bg-background text-foreground shadow-sm'
      : `
        text-muted-foreground
        hover:text-foreground
      `}
              `}
              onClick={() => setMode('sign-up')}
            >
              Sign up
            </button>
          </div>

          {mode === 'sign-up' && (
            <label className="flex flex-col gap-2 text-sm font-medium">
              Name
              <input
                className="
                  h-10 rounded-lg border border-input bg-background px-3 text-sm
                  transition-shadow outline-none
                  focus-visible:ring-3 focus-visible:ring-ring/50
                "
                value={name}
                onChange={event => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              className="
                h-10 rounded-lg border border-input bg-background px-3 text-sm
                transition-shadow outline-none
                focus-visible:ring-3 focus-visible:ring-ring/50
              "
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Password
            <input
              className="
                h-10 rounded-lg border border-input bg-background px-3 text-sm
                transition-shadow outline-none
                focus-visible:ring-3 focus-visible:ring-ring/50
              "
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              minLength={8}
              required
            />
          </label>

          {error && (
            <p className="
              rounded-lg border border-destructive/30 bg-destructive/10 px-3
              py-2 text-sm text-destructive
            "
            >
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Working...' : submitLabel}
          </Button>
        </form>
      </section>
    </main>
  )
}

export default App
