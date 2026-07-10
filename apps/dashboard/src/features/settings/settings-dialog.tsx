import type { ThemePreference } from '../../shared/lib/theme'
import type { SettingsTab } from './settings-state'
import type { LanguagePreference } from './settings-utils'

import { Avatar, AvatarFallback } from '@talelabs/ui/components/avatar'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { cn } from '@talelabs/ui/lib/utils'
import { useMemo, useState } from 'react'
import { GeneralSettings } from './general-settings'
import { OrganizationSettings } from './organization-settings'
import { ProfileSettings } from './profile-settings'
import { SecuritySettings } from './security-settings'
import { settingsNavigation } from './settings-options'
import {
  getInitialLanguagePreference,
  getInitials,
  languageStorageKey,
} from './settings-utils'
import { TeamSettings } from './team-settings'

export function SettingsDialog({
  activeOrganizationId,
  currentSessionId,
  email,
  isTeamInviteFormOpen,
  name,
  onOpenChange,
  onOpenCookiePreferences,
  onProfileUpdated,
  onSignOut,
  onTabChange,
  onTeamInviteFormOpenChange,
  onThemeChange,
  open,
  tab,
  theme,
}: {
  activeOrganizationId: string | null
  currentSessionId: string | undefined
  email: string
  isTeamInviteFormOpen: boolean
  name: string
  onOpenChange: (open: boolean) => void
  onOpenCookiePreferences: () => void
  onProfileUpdated: () => Promise<void>
  onSignOut: () => Promise<void>
  onTabChange: (tab: SettingsTab) => void
  onTeamInviteFormOpenChange: (open: boolean) => void
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
                onOpenCookiePreferences={onOpenCookiePreferences}
                onLanguageChange={handleLanguageChange}
                onThemeChange={onThemeChange}
                theme={theme}
              />
            )}
            {tab === 'organization' && (
              <OrganizationSettings activeOrganizationId={activeOrganizationId} />
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
              <TeamSettings
                activeOrganizationId={activeOrganizationId}
                isInviteFormOpen={isTeamInviteFormOpen}
                onInviteFormOpenChange={onTeamInviteFormOpenChange}
              />
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
