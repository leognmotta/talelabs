import type { ThemePreference } from '../../shared/lib/theme'
import type { SettingsTab } from './settings-state'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  IconCopy,
  IconCreditCard,
  IconDeviceDesktop,
  IconLogout,
  IconMailForward,
  IconMoon,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconShieldLock,
  IconSun,
  IconUserCircle,
  IconUsersGroup,
} from '@tabler/icons-react'
import {
  ApiError,
  createOrganizationInvitation,
  listOrganizationInvitationsQueryKey,
  setAccountPassword,
  useListOrganizationInvitations,
  useListOrganizationMembers,
} from '@talelabs/sdk'
import {
  Avatar,
  AvatarFallback,
} from '@talelabs/ui/components/avatar'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import {
  NativeSelect,
  NativeSelectOption,
} from '@talelabs/ui/components/native-select'
import { Separator } from '@talelabs/ui/components/separator'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@talelabs/ui/components/table'
import { cn } from '@talelabs/ui/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { authClient } from '../auth/auth-client'

type AuthSession = NonNullable<
  Awaited<ReturnType<typeof authClient.listSessions>>['data']
>[number]
type AuthAccount = NonNullable<
  Awaited<ReturnType<typeof authClient.listAccounts>>['data']
>[number]

const settingsNavigation: {
  icon: typeof IconSettings
  label: string
  value: SettingsTab
}[] = [
  { icon: IconSettings, label: 'General', value: 'general' },
  { icon: IconUserCircle, label: 'Profile', value: 'profile' },
  { icon: IconShieldLock, label: 'Security', value: 'security' },
  { icon: IconUsersGroup, label: 'Team', value: 'team' },
  { icon: IconCreditCard, label: 'Billing', value: 'billing' },
]

const themeOptions: {
  icon: typeof IconSun
  label: string
  value: ThemePreference
}[] = [
  { icon: IconSun, label: 'Light', value: 'light' },
  { icon: IconMoon, label: 'Dark', value: 'dark' },
  { icon: IconDeviceDesktop, label: 'System', value: 'system' },
]

type LanguagePreference = 'auto' | 'en' | 'pt-BR'

const languageStorageKey = 'talelabs_language'

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
})

type ProfileFormValues = z.infer<typeof profileSchema>

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
})

type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>

const createPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
})

type CreatePasswordFormValues = z.infer<typeof createPasswordSchema>

const teamInvitationSchema = z.object({
  email: z.string().trim().email('Enter a valid email.'),
  role: z.enum(['admin', 'member']),
})

type TeamInvitationFormValues = z.infer<typeof teamInvitationSchema>

interface TeamMemberRow {
  createdAt: string
  email: string
  id: string
  inviteUrl?: string
  name: string
  role: 'admin' | 'member'
  sourceId: string
  status: 'active' | 'pending'
}

function getInitialLanguagePreference(): LanguagePreference {
  if (typeof window === 'undefined')
    return 'auto'

  const stored = window.localStorage.getItem(languageStorageKey)
  if (stored === 'en' || stored === 'pt-BR' || stored === 'auto')
    return stored

  return 'auto'
}

function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim()
  return source
    .split(/[ @._-]+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getDeviceName(userAgent: string | null | undefined) {
  if (!userAgent)
    return 'Unknown device'

  if (/iphone/i.test(userAgent))
    return 'iPhone'
  if (/ipad/i.test(userAgent))
    return 'iPad'
  if (/android/i.test(userAgent))
    return 'Android'
  if (/macintosh|mac os/i.test(userAgent))
    return 'Macintosh'
  if (/windows/i.test(userAgent))
    return 'Windows'
  if (/linux/i.test(userAgent))
    return 'Linux'

  return 'Device'
}

function getBrowserName(userAgent: string | null | undefined) {
  if (!userAgent)
    return 'Browser'

  if (/edg\//i.test(userAgent))
    return 'Microsoft Edge'
  if (/chrome|crios/i.test(userAgent))
    return 'Chrome'
  if (/firefox|fxios/i.test(userAgent))
    return 'Firefox'
  if (/safari/i.test(userAgent))
    return 'Safari'

  return 'Browser'
}

function formatSessionDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function SettingsRow({
  children,
  description,
  label,
}: {
  children: React.ReactNode
  description?: string
  label: string
}) {
  return (
    <div className="
      grid gap-3 py-4
      sm:grid-cols-[minmax(9rem,13rem)_1fr] sm:items-center
    "
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="
        flex min-w-0 justify-start
        sm:justify-end
      "
      >
        {children}
      </div>
    </div>
  )
}

export function SettingsDialog({
  activeOrganizationId,
  currentSessionId,
  email,
  name,
  onOpenChange,
  onProfileUpdated,
  onSignOut,
  onTabChange,
  onThemeChange,
  open,
  tab,
  theme,
}: {
  activeOrganizationId: string | null
  currentSessionId: string | undefined
  email: string
  name: string
  onOpenChange: (open: boolean) => void
  onProfileUpdated: () => Promise<void>
  onSignOut: () => Promise<void>
  onTabChange: (tab: SettingsTab) => void
  onThemeChange: (theme: ThemePreference) => void
  open: boolean
  tab: SettingsTab
  theme: ThemePreference
}) {
  const initials = useMemo(() => getInitials(name, email), [email, name])
  const [language, setLanguage] = useState<LanguagePreference>(
    getInitialLanguagePreference,
  )

  function handleLanguageChange(nextLanguage: LanguagePreference) {
    setLanguage(nextLanguage)
    window.localStorage.setItem(languageStorageKey, nextLanguage)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          h-[min(760px,calc(100svh-2rem))] overflow-hidden rounded-3xl p-0
          sm:max-w-[920px]
        "
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage account and workspace settings.</DialogDescription>
        </DialogHeader>
        <div className="
          grid h-full min-h-0 grid-cols-1
          md:grid-cols-[245px_1fr]
        "
        >
          <aside className="
            border-b border-border bg-muted/30 p-4
            md:border-r md:border-b-0
          "
          >
            <div className="mb-5 flex items-center gap-3 pr-10">
              <Avatar className="size-9 rounded-xl">
                <AvatarFallback className="rounded-xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              </div>
            </div>
            <nav className="
              flex gap-1 overflow-x-auto
              md:flex-col md:overflow-visible
            "
            >
              {settingsNavigation.map((item) => {
                const Icon = item.icon
                const isActive = tab === item.value

                return (
                  <Button
                    key={item.value}
                    type="button"
                    variant="ghost"
                    className={cn(
                      `
                        h-9 justify-start rounded-2xl px-3 text-muted-foreground
                        hover:text-foreground
                      `,
                      isActive && 'bg-muted text-foreground',
                    )}
                    onClick={() => onTabChange(item.value)}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </Button>
                )
              })}
            </nav>
          </aside>
          <section className="min-h-0 overflow-y-auto p-6">
            {tab === 'general' && (
              <GeneralSettings
                language={language}
                onLanguageChange={handleLanguageChange}
                onThemeChange={onThemeChange}
                theme={theme}
              />
            )}
            {tab === 'profile' && (
              <ProfileSettings
                key={`${email}:${name}`}
                email={email}
                initials={initials}
                name={name}
                onProfileUpdated={onProfileUpdated}
              />
            )}
            {tab === 'security' && (
              <SecuritySettings
                currentSessionId={currentSessionId}
                onSignOut={onSignOut}
                open={open}
              />
            )}
            {tab === 'team' && (
              <TeamSettings activeOrganizationId={activeOrganizationId} />
            )}
            {tab === 'billing' && <BillingSettings />}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GeneralSettings({
  language,
  onLanguageChange,
  onThemeChange,
  theme,
}: {
  language: LanguagePreference
  onLanguageChange: (language: LanguagePreference) => void
  onThemeChange: (theme: ThemePreference) => void
  theme: ThemePreference
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pb-4">
        <h2 className="text-lg font-semibold">General</h2>
      </header>
      <Separator />
      <SettingsRow label="Theme">
        <div className="
          grid w-full grid-cols-3 gap-2
          sm:w-auto
        "
        >
          {themeOptions.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.value}
                type="button"
                variant={theme === item.value ? 'secondary' : 'ghost'}
                className="justify-center"
                onClick={() => onThemeChange(item.value)}
              >
                <Icon />
                <span>{item.label}</span>
              </Button>
            )
          })}
        </div>
      </SettingsRow>
      <Separator />
      <SettingsRow label="Language">
        <NativeSelect
          aria-label="Language"
          value={language}
          className="
            w-full
            sm:w-44
          "
          onChange={(event) => {
            const nextLanguage = event.target.value
            if (
              nextLanguage === 'auto'
              || nextLanguage === 'en'
              || nextLanguage === 'pt-BR'
            ) {
              onLanguageChange(nextLanguage)
            }
          }}
        >
          <NativeSelectOption value="auto">Auto-detect</NativeSelectOption>
          <NativeSelectOption value="en">English</NativeSelectOption>
          <NativeSelectOption value="pt-BR">Portuguese</NativeSelectOption>
        </NativeSelect>
      </SettingsRow>
    </div>
  )
}

function ProfileSettings({
  email,
  initials,
  name,
  onProfileUpdated,
}: {
  email: string
  initials: string
  name: string
  onProfileUpdated: () => Promise<void>
}) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name,
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form

  async function handleSubmit(values: ProfileFormValues) {
    form.clearErrors('root.serverError')

    try {
      const nextName = values.name.trim()
      const result = await authClient.updateUser({ name: nextName })

      if (result.error) {
        form.setError('root.serverError', {
          message: result.error.message ?? 'Could not update profile.',
          type: 'server',
        })
        return
      }

      form.reset({ name: nextName })
      await onProfileUpdated()
      toast.success('Profile updated')
    }
    catch {
      form.setError('root.serverError', {
        message: 'Could not update profile.',
        type: 'server',
      })
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pb-4">
        <h2 className="text-lg font-semibold">Profile</h2>
      </header>
      <Separator />
      <form
        className="flex flex-col gap-5 py-5"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <div className="flex items-center gap-4">
          <Avatar className="size-14 rounded-2xl">
            <AvatarFallback className="rounded-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
        <FieldGroup>
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="settings-profile-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="settings-profile-name"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Field>
            <FieldLabel htmlFor="settings-profile-email">Email</FieldLabel>
            <Input id="settings-profile-email" value={email} disabled />
          </Field>
        </FieldGroup>
        {errors.root?.serverError && (
          <FieldError>
            {errors.root.serverError.message}
          </FieldError>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save profile'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function SecuritySettings({
  currentSessionId,
  onSignOut,
  open,
}: {
  currentSessionId: string | undefined
  onSignOut: () => Promise<void>
  open: boolean
}) {
  const [sessions, setSessions] = useState<AuthSession[]>([])
  const [accounts, setAccounts] = useState<AuthAccount[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false)
  const [revokingToken, setRevokingToken] = useState<string | null>(null)
  const hasPassword = accounts.some(account => account.providerId === 'credential')

  async function loadSessions() {
    setIsLoading(true)
    setError(null)

    const [sessionsResult, accountsResult] = await Promise.all([
      authClient.listSessions(),
      authClient.listAccounts(),
    ])

    if (sessionsResult.error) {
      setError(sessionsResult.error.message ?? 'Could not load active sessions.')
      setIsLoading(false)
      return
    }

    if (accountsResult.error) {
      setError(accountsResult.error.message ?? 'Could not load account security.')
      setIsLoading(false)
      return
    }

    setSessions(sessionsResult.data ?? [])
    setAccounts(accountsResult.data ?? [])
    setIsLoading(false)
  }

  useEffect(() => {
    if (open)
      void loadSessions()
  }, [open])

  async function handleRevokeSession(session: AuthSession) {
    const isCurrentSession = session.id === currentSessionId

    setRevokingToken(session.token)
    const result = await authClient.revokeSession({ token: session.token })

    if (result.error) {
      toast.error(result.error.message ?? 'Could not revoke session.')
      setRevokingToken(null)
      return
    }

    if (isCurrentSession) {
      await onSignOut()
      return
    }

    await loadSessions()
    setRevokingToken(null)
    toast.success('Session revoked')
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 pb-4">
        <h2 className="text-lg font-semibold">Security</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadSessions()}
          disabled={isLoading}
        >
          <IconRefresh />
          Refresh
        </Button>
      </header>
      <Separator />
      <div className="py-5">
        <div className="
          flex flex-col gap-3
          sm:flex-row sm:items-start sm:justify-between
        "
        >
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasPassword
                ? 'Update the password used for email sign-in.'
                : 'Create a password for email sign-in.'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => setIsPasswordFormOpen(open => !open)}
          >
            {hasPassword ? 'Update password' : 'Create password'}
          </Button>
        </div>
        {isPasswordFormOpen && (
          <div className="mt-5 max-w-sm">
            {isLoading
              ? <Skeleton className="h-28 w-full" />
              : (
                  <PasswordSettingsForm
                    hasPassword={hasPassword}
                    onPasswordChanged={async () => {
                      await loadSessions()
                      setIsPasswordFormOpen(false)
                    }}
                  />
                )}
          </div>
        )}
      </div>
      <Separator />
      <div className="py-5">
        <div className="
          grid gap-3
          sm:grid-cols-[minmax(9rem,13rem)_1fr]
        "
        >
          <p className="text-sm font-medium">Active sessions</p>
          <div className="flex min-w-0 flex-col gap-3">
            {isLoading && sessions.length === 0 && (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {!isLoading && !error && sessions.length === 0 && (
              <p className="text-sm text-muted-foreground">No active sessions found.</p>
            )}
            {sessions.map((session) => {
              const isCurrentSession = session.id === currentSessionId
              const browserName = getBrowserName(session.userAgent)
              const deviceName = getDeviceName(session.userAgent)

              return (
                <div
                  key={session.id}
                  className="
                    flex flex-col gap-3 rounded-2xl border border-border p-4
                    sm:flex-row sm:items-start sm:justify-between
                  "
                >
                  <div className="flex min-w-0 gap-3">
                    <span className="
                      mt-0.5 flex size-9 shrink-0 items-center justify-center
                      rounded-xl bg-muted text-muted-foreground
                    "
                    >
                      <IconDeviceDesktop />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{deviceName}</p>
                        {isCurrentSession && (
                          <Badge variant="secondary">This device</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {browserName}
                        {session.ipAddress ? ` - ${session.ipAddress}` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Last active
                        {' '}
                        {formatSessionDate(session.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={isCurrentSession ? 'outline' : 'destructive'}
                    size="sm"
                    disabled={revokingToken === session.token}
                    onClick={() => void handleRevokeSession(session)}
                  >
                    <IconLogout />
                    {isCurrentSession ? 'Sign out' : 'Revoke'}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function PasswordSettingsForm({
  hasPassword,
  onPasswordChanged,
}: {
  hasPassword: boolean
  onPasswordChanged: () => Promise<void>
}) {
  return hasPassword
    ? <UpdatePasswordForm onPasswordChanged={onPasswordChanged} />
    : <CreatePasswordForm onPasswordChanged={onPasswordChanged} />
}

function UpdatePasswordForm({
  onPasswordChanged,
}: {
  onPasswordChanged: () => Promise<void>
}) {
  const form = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form

  async function handleSubmit(values: UpdatePasswordFormValues) {
    form.clearErrors('root.serverError')

    try {
      const result = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: false,
      })

      if (result.error) {
        form.setError('root.serverError', {
          message: result.error.message ?? 'Could not update password.',
          type: 'server',
        })
        return
      }

      form.reset()
      await onPasswordChanged()
      toast.success('Password updated')
    }
    catch {
      form.setError('root.serverError', {
        message: 'Could not update password.',
        type: 'server',
      })
    }
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <FieldGroup className="gap-4">
        <Controller
          name="currentPassword"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="settings-current-password">
                Current password
              </FieldLabel>
              <Input
                {...field}
                id="settings-current-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
        <Controller
          name="newPassword"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="settings-new-password">
                New password
              </FieldLabel>
              <Input
                {...field}
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
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
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Updating...' : 'Update password'}
      </Button>
    </form>
  )
}

function CreatePasswordForm({
  onPasswordChanged,
}: {
  onPasswordChanged: () => Promise<void>
}) {
  const form = useForm<CreatePasswordFormValues>({
    resolver: zodResolver(createPasswordSchema),
    defaultValues: {
      newPassword: '',
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form

  async function handleSubmit(values: CreatePasswordFormValues) {
    form.clearErrors('root.serverError')

    try {
      await setAccountPassword({
        data: {
          newPassword: values.newPassword,
        },
      })

      form.reset()
      await onPasswordChanged()
      toast.success('Password created')
    }
    catch (caughtError) {
      const message = caughtError instanceof ApiError
        && caughtError.data
        && typeof caughtError.data === 'object'
        && 'error' in caughtError.data
        && typeof caughtError.data.error === 'string'
        ? caughtError.data.error
        : 'Could not create password.'

      form.setError('root.serverError', {
        message,
        type: 'server',
      })
    }
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <Controller
        name="newPassword"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="settings-create-password">
              Password
            </FieldLabel>
            <Input
              {...field}
              id="settings-create-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && (
              <FieldError errors={[fieldState.error]} />
            )}
          </Field>
        )}
      />
      {errors.root?.serverError && (
        <FieldError>
          {errors.root.serverError.message}
        </FieldError>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create password'}
      </Button>
    </form>
  )
}

function TeamSettings({
  activeOrganizationId,
}: {
  activeOrganizationId: string | null
}) {
  const [isInviteFormOpen, setIsInviteFormOpen] = useState(false)
  const queryClient = useQueryClient()
  const organizationId = activeOrganizationId ?? undefined
  const membersQuery = useListOrganizationMembers(
    { organizationId },
    {
      query: {
        retry: false,
      },
    },
  )
  const invitationsQuery = useListOrganizationInvitations(
    { organizationId },
    {
      query: {
        retry: false,
      },
    },
  )
  const members = useMemo(
    () => membersQuery.data?.members ?? [],
    [membersQuery.data],
  )
  const invitations = useMemo(
    () => invitationsQuery.data?.invitations ?? [],
    [invitationsQuery.data],
  )
  const rows = useMemo(() => {
    const memberRows = members.map((member): TeamMemberRow => ({
      createdAt: member.createdAt,
      email: member.email,
      id: `member:${member.id}`,
      name: member.name,
      role: member.role,
      sourceId: member.id,
      status: 'active',
    }))
    const pendingInvitationRows = invitations
      .filter(invitation => invitation.status !== 'accepted')
      .map((invitation): TeamMemberRow => ({
        createdAt: invitation.createdAt,
        email: invitation.email,
        id: `invitation:${invitation.id}`,
        inviteUrl: invitation.inviteUrl,
        name: 'Invited user',
        role: invitation.role,
        sourceId: invitation.id,
        status: 'pending',
      }))

    return [...memberRows, ...pendingInvitationRows]
  }, [invitations, members])
  const isLoading = membersQuery.isLoading || invitationsQuery.isLoading
  const isError = membersQuery.isError || invitationsQuery.isError

  async function handleCopyInviteLink(row: TeamMemberRow) {
    if (!row.inviteUrl)
      return

    await navigator.clipboard?.writeText(row.inviteUrl)
    toast.success('Invitation URL copied')
  }

  async function handleResendInvite(row: TeamMemberRow) {
    if (!activeOrganizationId)
      return

    try {
      await createOrganizationInvitation({
        organizationId: activeOrganizationId,
        data: {
          email: row.email,
          role: row.role,
          resend: true,
        },
      })
      await queryClient.invalidateQueries({
        queryKey: listOrganizationInvitationsQueryKey({
          organizationId: activeOrganizationId,
        }),
      })
      toast.success('Invitation email resent')
    }
    catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : 'Could not resend invitation.'
      toast.error(message)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="flex items-center justify-between gap-3 pb-4">
        <h2 className="text-lg font-semibold">Team</h2>
        {activeOrganizationId && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsInviteFormOpen(open => !open)}
          >
            <IconPlus />
            Invite user
          </Button>
        )}
      </header>
      <Separator className="mb-5" />
      {!activeOrganizationId && (
        <p className="text-sm text-muted-foreground">
          No active organization.
        </p>
      )}
      {activeOrganizationId && (
        <div className="flex flex-col gap-5">
          {isInviteFormOpen && (
            <TeamInvitationForm
              organizationId={activeOrganizationId}
              onInvitationCreated={() => setIsInviteFormOpen(false)}
            />
          )}
          {isError && (
            <p className="text-sm text-muted-foreground">
              Organization admins can view members and invitations.
            </p>
          )}
          {!isError && (
            <TeamMembersTable
              isLoading={isLoading}
              rows={rows}
              onCopyInviteLink={(row) => {
                void handleCopyInviteLink(row)
              }}
              onResendInvite={(row) => {
                void handleResendInvite(row)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function TeamInvitationForm({
  onInvitationCreated,
  organizationId,
}: {
  onInvitationCreated: () => void
  organizationId: string
}) {
  const queryClient = useQueryClient()
  const form = useForm<TeamInvitationFormValues>({
    resolver: zodResolver(teamInvitationSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  })
  const {
    control,
    formState: { errors, isSubmitting },
  } = form

  async function handleSubmit(values: TeamInvitationFormValues) {
    form.clearErrors('root.serverError')

    try {
      const result = await createOrganizationInvitation({
        organizationId,
        data: {
          email: values.email,
          role: values.role,
        },
      })

      form.reset({
        email: '',
        role: values.role,
      })
      await queryClient.invalidateQueries({
        queryKey: listOrganizationInvitationsQueryKey({ organizationId }),
      })
      await navigator.clipboard?.writeText(result.invitation.inviteUrl)
      toast.success('Invitation URL copied')
      onInvitationCreated()
    }
    catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : 'Could not create invitation.'
      form.setError('root.serverError', {
        message,
        type: 'server',
      })
    }
  }

  return (
    <form
      className="rounded-2xl border border-border p-4"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <FieldGroup>
        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="team-invite-email">Email</FieldLabel>
              <Input
                {...field}
                id="team-invite-email"
                type="email"
                placeholder="new-user@example.com"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
        <Controller
          name="role"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="team-invite-role">Role</FieldLabel>
              <NativeSelect
                id="team-invite-role"
                value={field.value}
                onChange={(event) => {
                  const nextRole = event.target.value === 'admin'
                    ? 'admin'
                    : 'member'
                  field.onChange(nextRole)
                }}
                aria-invalid={fieldState.invalid}
              >
                <NativeSelectOption value="member">Member</NativeSelectOption>
                <NativeSelectOption value="admin">Admin</NativeSelectOption>
              </NativeSelect>
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
      </FieldGroup>
      {errors.root?.serverError && (
        <FieldError className="mt-4">
          {errors.root.serverError.message}
        </FieldError>
      )}
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send invite'}
        </Button>
      </div>
    </form>
  )
}

const teamColumnHelper = createColumnHelper<TeamMemberRow>()

function TeamMembersTable({
  isLoading,
  onCopyInviteLink,
  onResendInvite,
  rows,
}: {
  isLoading: boolean
  onCopyInviteLink: (row: TeamMemberRow) => void
  onResendInvite: (row: TeamMemberRow) => void
  rows: TeamMemberRow[]
}) {
  const columns = useMemo(() => [
    teamColumnHelper.accessor('name', {
      header: 'Member',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.email}
          </p>
        </div>
      ),
    }),
    teamColumnHelper.accessor('role', {
      header: 'Role',
      cell: info => (
        <span className="capitalize">{info.getValue()}</span>
      ),
    }),
    teamColumnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <Badge variant={info.getValue() === 'active' ? 'secondary' : 'outline'}>
          {info.getValue() === 'active' ? 'Active' : 'Pending'}
        </Badge>
      ),
    }),
    teamColumnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        if (row.original.status !== 'pending') {
          return null
        }

        return (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Copy invite link"
              onClick={() => onCopyInviteLink(row.original)}
            >
              <IconCopy />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Resend invite email"
              onClick={() => onResendInvite(row.original)}
            >
              <IconMailForward />
            </Button>
          </div>
        )
      },
    }),
  ], [onCopyInviteLink, onResendInvite])
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0
            ? table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No team members found.
                  </TableCell>
                </TableRow>
              )}
        </TableBody>
      </Table>
    </div>
  )
}

function BillingSettings() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pb-4">
        <h2 className="text-lg font-semibold">Billing</h2>
      </header>
      <Separator />
      <SettingsRow label="Plan">
        <Badge variant="secondary">Free</Badge>
      </SettingsRow>
      <Separator />
      <SettingsRow label="Payment method">
        <span className="text-sm text-muted-foreground">Not connected</span>
      </SettingsRow>
      <Separator />
      <SettingsRow label="Invoices">
        <span className="text-sm text-muted-foreground">No invoices</span>
      </SettingsRow>
    </div>
  )
}
