import type { FormEvent } from 'react'
import type { ThemePreference } from '../../shared/lib/theme'
import type { SettingsTab } from './settings-state'

import {
  IconCreditCard,
  IconDeviceDesktop,
  IconLogout,
  IconMoon,
  IconRefresh,
  IconSettings,
  IconShieldLock,
  IconSun,
  IconUserCircle,
  IconUsersGroup,
} from '@tabler/icons-react'
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
import { cn } from '@talelabs/ui/lib/utils'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { authClient } from '../auth/auth-client'
import { InvitationsPanel } from '../organizations/invitations-panel'

type AuthSession = NonNullable<
  Awaited<ReturnType<typeof authClient.listSessions>>['data']
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
  const [profileName, setProfileName] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextName = profileName.trim()
    if (!nextName) {
      setError('Name is required.')
      return
    }

    setIsSaving(true)
    setError(null)

    const result = await authClient.updateUser({ name: nextName })

    if (result.error) {
      setError(result.error.message ?? 'Could not update profile.')
      setIsSaving(false)
      return
    }

    await onProfileUpdated()
    setIsSaving(false)
    toast.success('Profile updated')
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pb-4">
        <h2 className="text-lg font-semibold">Profile</h2>
      </header>
      <Separator />
      <form className="flex flex-col gap-5 py-5" onSubmit={handleSubmit}>
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
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="settings-profile-name">Name</FieldLabel>
            <Input
              id="settings-profile-name"
              value={profileName}
              onChange={event => setProfileName(event.target.value)}
              aria-invalid={!!error}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-profile-email">Email</FieldLabel>
            <Input id="settings-profile-email" value={email} disabled />
          </Field>
        </FieldGroup>
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save profile'}
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revokingToken, setRevokingToken] = useState<string | null>(null)

  async function loadSessions() {
    setIsLoading(true)
    setError(null)

    const result = await authClient.listSessions()

    if (result.error) {
      setError(result.error.message ?? 'Could not load active sessions.')
      setIsLoading(false)
      return
    }

    setSessions(result.data ?? [])
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
      <SettingsRow label="Password">
        <span className="text-sm text-muted-foreground">Managed by your sign-in provider</span>
      </SettingsRow>
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

function TeamSettings({
  activeOrganizationId,
}: {
  activeOrganizationId: string | null
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pb-4">
        <h2 className="text-lg font-semibold">Team</h2>
      </header>
      <Separator className="mb-5" />
      {activeOrganizationId
        ? <InvitationsPanel organizationId={activeOrganizationId} />
        : (
            <p className="text-sm text-muted-foreground">
              No active organization.
            </p>
          )}
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
