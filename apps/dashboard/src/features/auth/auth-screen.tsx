/** Branded sign-in and sign-up entry surface. */
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

import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { LocalizedFieldError } from '../../shared/components/localized-field-error'
import { PasswordInput } from '../../shared/components/password-input'
import { TaleLabsLogo } from '../../shared/components/talelabs-logo'
import { getAuthErrorMessage } from '../../shared/lib/auth-error'
import { authClient, signIn, signUp } from './auth-client'
import { AuthModeLink } from './auth-mode-link'
import { GoogleLogo } from './google-logo'

const authBaseSchema = z.object({
  email: z.string().trim().email({ error: 'validation.email' }),
  name: z.string(),
  password: z.string().min(8, { error: 'validation.passwordMinLength' }),
})

const signUpSchema = authBaseSchema.extend({
  name: z.string().trim().min(1, { error: 'validation.nameRequired' }),
})

type AuthFormValues = z.infer<typeof authBaseSchema>

/** Renders the branded authentication surface for the requested auth mode. */
export function AuthScreen({
  initialMode,
  onAuthenticated,
}: {
  initialMode: AuthMode
  onAuthenticated: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)

  const mode = initialMode
  const title = mode === 'sign-in' ? t('auth.signIn') : t('auth.createAccount')
  const submitLabel = mode === 'sign-in' ? t('auth.signIn') : t('auth.createAccount')
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
          message: getAuthErrorMessage(result.error, 'auth.authenticationFailed'),
          type: 'server',
        })
        return
      }

      await onAuthenticated()
    }
    catch {
      form.setError('root.serverError', {
        message: t('auth.authenticationFailed'),
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
        message: getAuthErrorMessage(result.error, 'auth.couldNotContinueWithGoogle'),
        type: 'server',
      })
    }
  }

  return (
    <main
      data-auth-screen
      className="
        flex min-h-dvh items-center justify-center p-4 text-foreground
        sm:px-6 sm:py-8
        lg:py-4
      "
    >
      <section className="
        grid w-full max-w-6xl overflow-hidden rounded-2xl border border-border
        bg-card
        lg:min-h-[680px] lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]
      "
      >
        <div className="
          relative hidden overflow-hidden border-r border-border p-12
          lg:flex lg:flex-col
        "
        >
          <div className="flex items-center gap-3">
            <TaleLabsLogo className="h-7 w-32" variant="full" />
            <span className="sr-only">{t('common.appName')}</span>
          </div>

          <div className="my-auto flex max-w-lg flex-col items-start py-12">
            <p className="
              max-w-md text-5xl/none font-semibold tracking-[-0.045em]
            "
            >
              {t('auth.brandTitle')}
            </p>
            <p className="mt-5 max-w-md text-base/7 text-muted-foreground">
              {t('auth.brandDescription')}
            </p>
          </div>

          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 grid h-1 grid-cols-5"
          >
            <span className="bg-(--brand-dune)" />
            <span className="bg-(--brand-flora)" />
            <span className="bg-(--brand-glacier)" />
            <span className="bg-(--brand-terra)" />
            <span className="bg-(--brand-twilight)" />
          </div>
        </div>

        <form
          className="
            mx-auto flex w-full max-w-lg flex-col justify-center gap-6 px-6
            py-10
            sm:px-10 sm:py-12
            lg:px-12
          "
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div className="
            mb-2
            lg:hidden
          "
          >
            <TaleLabsLogo className="h-7 w-32" variant="full" />
            <span className="sr-only">{t('common.appName')}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm/6 text-muted-foreground">
              {t('auth.useWorkEmail')}
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            <AuthModeLink isActive={mode === 'sign-in'} to="/sign-in">
              {t('auth.signIn')}
            </AuthModeLink>
            <AuthModeLink isActive={mode === 'sign-up'} to="/sign-up">
              {t('auth.signUp')}
            </AuthModeLink>
          </nav>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11"
            disabled={isSubmitting || isGoogleSubmitting}
            onClick={() => void handleGoogleSignIn()}
          >
            <GoogleLogo data-icon="inline-start" />
            {isGoogleSubmitting ? t('auth.openingGoogle') : t('auth.continueWithGoogle')}
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            <span>{t('common.email')}</span>
            <Separator className="flex-1" />
          </div>

          {mode === 'sign-up' && (
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="auth-name">{t('common.name')}</FieldLabel>
                  <Input
                    {...field}
                    id="auth-name"
                    autoComplete="name"
                    className="h-11"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <LocalizedFieldError error={fieldState.error} />
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
                  <FieldLabel htmlFor="auth-email">{t('common.email')}</FieldLabel>
                  <Input
                    {...field}
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    className="h-11"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <LocalizedFieldError error={fieldState.error} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="password"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="auth-password">{t('common.password')}</FieldLabel>
                  <PasswordInput
                    {...field}
                    id="auth-password"
                    autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                    className="h-11"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <LocalizedFieldError error={fieldState.error} />
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

          <Button
            type="submit"
            size="lg"
            className="h-11"
            disabled={isSubmitting || isGoogleSubmitting}
          >
            {isSubmitting ? t('auth.working') : submitLabel}
          </Button>
        </form>
      </section>
    </main>
  )
}
