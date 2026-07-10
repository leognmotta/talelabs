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
import { useNavigate } from 'react-router'

const pageActions: {
  hidden?: boolean
  icon: typeof IconArchive
  title: string
  url: string
}[] = [
  { icon: IconArchive, title: 'Assets', url: '/assets' },
  { icon: IconGitBranch, title: 'Flows', url: '/flows' },
  { icon: IconComponents, title: 'Elements', url: '/elements' },
]

const settingsActions = [
  { icon: IconSettings, title: 'General settings', tab: 'general' },
  { icon: IconBuilding, title: 'Organization settings', tab: 'organization' },
  { icon: IconUserCircle, title: 'Profile', tab: 'profile' },
  { icon: IconUsersGroup, title: 'Invite member', tab: 'team' },
] satisfies {
  icon: typeof IconSettings
  title: string
  tab: SettingsTab
}[]

export function GlobalSearch({
  onOpenInviteMemberSettings,
  onOpenSettings,
}: {
  onOpenInviteMemberSettings: () => void
  onOpenSettings: (tab?: SettingsTab) => void
}) {
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
          Search pages and settings...
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
        title="Search"
        description="Search pages and settings."
        className="sm:max-w-[580px]"
      >
        <Command>
          <CommandInput placeholder="Search pages and settings..." />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Pages">
              {visiblePageActions.map((action) => {
                const Icon = action.icon

                return (
                  <CommandItem
                    key={action.title}
                    value={action.title}
                    onSelect={() => handleNavigate(action.url)}
                  >
                    <Icon />
                    <span>{action.title}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              {settingsActions.map((action) => {
                const Icon = action.icon

                return (
                  <CommandItem
                    key={action.title}
                    value={action.title}
                    onSelect={() => handleOpenSettings(action.tab)}
                  >
                    <Icon />
                    <span>{action.title}</span>
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
