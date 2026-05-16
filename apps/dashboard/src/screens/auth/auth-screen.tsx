import type { FormEvent } from 'react'
import type { AuthMode } from '../../types/auth'
import { Button } from '@connecto/ui/components/button'
import { useState } from 'react'

import { NavLink } from 'react-router'
import { signIn, signUp } from '../../lib/auth-client'

export function AuthScreen({
  initialMode,
  onAuthenticated,
}: {
  initialMode: AuthMode
  onAuthenticated: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const mode = initialMode
  const title = mode === 'sign-in' ? 'Sign in' : 'Create account'
  const submitLabel = mode === 'sign-in' ? 'Sign in' : 'Create account'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    await onAuthenticated()
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
            <p className="text-sm font-medium text-muted-foreground">Connecto</p>
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

          <nav className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <AuthModeLink isActive={mode === 'sign-in'} to="/sign-in">
              Sign in
            </AuthModeLink>
            <AuthModeLink isActive={mode === 'sign-up'} to="/sign-up">
              Sign up
            </AuthModeLink>
          </nav>

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

function AuthModeLink({
  children,
  isActive,
  to,
}: {
  children: string
  isActive: boolean
  to: string
}) {
  return (
    <NavLink
      to={to}
      className={`
        h-9 cursor-pointer rounded-md text-center text-sm/9 font-medium
        transition-colors
        ${isActive
      ? 'bg-background text-foreground shadow-sm'
      : `
        text-muted-foreground
        hover:text-foreground
      `}
      `}
    >
      {children}
    </NavLink>
  )
}
