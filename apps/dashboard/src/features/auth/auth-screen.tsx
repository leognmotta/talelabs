import type { ComponentProps } from 'react'
import type { AuthMode } from '../../shared/types/auth'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@talelabs/ui/components/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Separator } from '@talelabs/ui/components/separator'
import { useState } from 'react'

import { Controller, useForm } from 'react-hook-form'
import { NavLink } from 'react-router'
import { z } from 'zod'
import { authClient, signIn, signUp } from './auth-client'

const authBaseSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  name: z.string(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

const signUpSchema = authBaseSchema.extend({
  name: z.string().trim().min(1, 'Name is required.'),
})

type AuthFormValues = z.infer<typeof authBaseSchema>

export function AuthScreen({
  initialMode,
  onAuthenticated,
}: {
  initialMode: AuthMode
  onAuthenticated: () => Promise<void>
}) {
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)

  const mode = initialMode
  const title = mode === 'sign-in' ? 'Sign in' : 'Create account'
  const submitLabel = mode === 'sign-in' ? 'Sign in' : 'Create account'
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(mode === 'sign-in' ? authBaseSchema : signUpSchema),
    defaultValues: {
      email: '',
      name: '',
      password: '',
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form

  async function handleSubmit(values: AuthFormValues) {
    form.clearErrors('root.serverError')

    try {
      const result = mode === 'sign-in'
        ? await signIn.email({
            email: values.email,
            password: values.password,
          })
        : await signUp.email({
            email: values.email,
            name: values.name,
            password: values.password,
          })

      if (result.error) {
        form.setError('root.serverError', {
          message: result.error.message ?? 'Authentication failed',
          type: 'server',
        })
        return
      }

      await onAuthenticated()
    }
    catch {
      form.setError('root.serverError', {
        message: 'Authentication failed',
        type: 'server',
      })
    }
  }

  async function handleGoogleSignIn() {
    form.clearErrors('root.serverError')
    setIsGoogleSubmitting(true)

    const result = await authClient.signIn.social({
      callbackURL: `${window.location.origin}/`,
      errorCallbackURL: `${window.location.origin}/sign-in`,
      newUserCallbackURL: `${window.location.origin}/create-organization`,
      provider: 'google',
    })

    if (result.error) {
      setIsGoogleSubmitting(false)
      form.setError('root.serverError', {
        message: result.error.message ?? 'Could not continue with Google',
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
            <p className="text-sm font-medium text-muted-foreground">TaleLabs</p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight">
              Organization-first workspace access
            </h1>
          </div>
          <p className="max-w-lg text-sm text-muted-foreground">
            Personal workspaces are disabled. Accounts must be connected to an
            organization before they can use the dashboard.
          </p>
        </div>

        <form
          className="flex flex-col gap-5 p-8"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
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

          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isSubmitting || isGoogleSubmitting}
            onClick={() => void handleGoogleSignIn()}
          >
            <GoogleLogo data-icon="inline-start" />
            {isGoogleSubmitting ? 'Opening Google...' : 'Continue with Google'}
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            <span>Email</span>
            <Separator className="flex-1" />
          </div>

          {mode === 'sign-up' && (
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="auth-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="auth-name"
                    autoComplete="name"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          )}

          <FieldGroup>
            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="auth-email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="password"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="auth-password">Password</FieldLabel>
                  <Input
                    {...field}
                    id="auth-password"
                    type="password"
                    autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                    aria-invalid={fieldState.invalid}
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

          <Button type="submit" size="lg" disabled={isSubmitting || isGoogleSubmitting}>
            {isSubmitting ? 'Working...' : submitLabel}
          </Button>
        </form>
      </section>
    </main>
  )
}

function GoogleLogo(props: ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...props}
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
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
