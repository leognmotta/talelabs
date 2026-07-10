import type { SettingsTab } from '../features/settings/settings-state'

import {
  IconArchive,
  IconBuilding,
  IconComponents,
  IconGitBranch,
  IconSearch,
  IconSettings,
  IconUserCircle,
  IconUsersGroup,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@talelabs/ui/components/command'
import { Kbd } from '@talelabs/ui/components/kbd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

const pageActions: {
  hidden?: boolean
  icon: typeof IconArchive
  titleKey: 'navigation.assets' | 'navigation.elements' | 'navigation.flows'
  url: string
}[] = [
  { icon: IconArchive, titleKey: 'navigation.assets', url: '/assets' },
  { icon: IconGitBranch, titleKey: 'navigation.flows', url: '/flows' },
  { icon: IconComponents, titleKey: 'navigation.elements', url: '/elements' },
]

const settingsActions = [
  { icon: IconSettings, titleKey: 'navigation.generalSettings', tab: 'general' },
  { icon: IconBuilding, titleKey: 'navigation.organizationSettings', tab: 'organization' },
  { icon: IconUserCircle, titleKey: 'navigation.profile', tab: 'profile' },
  { icon: IconUsersGroup, titleKey: 'navigation.inviteMember', tab: 'team' },
] satisfies {
  icon: typeof IconSettings
  titleKey: 'navigation.generalSettings' | 'navigation.inviteMember' | 'navigation.organizationSettings' | 'navigation.profile'
  tab: SettingsTab
}[]

export function GlobalSearch({
  onOpenInviteMemberSettings,
  onOpenSettings,
}: {
  onOpenInviteMemberSettings: () => void
  onOpenSettings: (tab?: SettingsTab) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const visiblePageActions = pageActions.filter(action => !action.hidden)
  const shortcutLabel = /Mac|iPhone|iPad|iPod/.test(window.navigator.platform)
    ? '⌘K'
    : 'Ctrl K'

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k')
        return

      event.preventDefault()
      setOpen(currentOpen => !currentOpen)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleNavigate(url: string) {
    setOpen(false)
    navigate(url)
  }

  function handleOpenSettings(tab: SettingsTab) {
    setOpen(false)

    if (tab === 'team')
      onOpenInviteMemberSettings()
    else
      onOpenSettings(tab)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="
          h-9 w-full max-w-md justify-start rounded-4xl px-3
          text-muted-foreground
        "
        onClick={() => setOpen(true)}
      >
        <IconSearch data-icon="inline-start" />
        <span className="
          hidden min-w-0 flex-1 truncate text-left
          sm:inline
        "
        >
          {t('search.placeholder')}
        </span>
        <Kbd className="
          ml-auto hidden
          sm:inline-flex
        "
        >
          {shortcutLabel}
        </Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t('search.title')}
        description={t('search.description')}
        className="sm:max-w-[580px]"
      >
        <Command>
          <CommandInput placeholder={t('search.placeholder')} />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>{t('search.empty')}</CommandEmpty>
            <CommandGroup heading={t('search.pages')}>
              {visiblePageActions.map((action) => {
                const Icon = action.icon

                return (
                  <CommandItem
                    key={action.titleKey}
                    value={t(action.titleKey)}
                    onSelect={() => handleNavigate(action.url)}
                  >
                    <Icon />
                    <span>{t(action.titleKey)}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={t('search.settings')}>
              {settingsActions.map((action) => {
                const Icon = action.icon

                return (
                  <CommandItem
                    key={action.titleKey}
                    value={t(action.titleKey)}
                    onSelect={() => handleOpenSettings(action.tab)}
                  >
                    <Icon />
                    <span>{t(action.titleKey)}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
