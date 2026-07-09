import type { SettingsTab } from '../features/settings/settings-state'

import {
  IconApps,
  IconArchive,
  IconBriefcase,
  IconBuildingStore,
  IconCreditCard,
  IconLayoutBoard,
  IconMovie,
  IconPackage,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconUserCircle,
  IconUsersGroup,
  IconUserSquareRounded,
  IconWand,
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
  CommandShortcut,
} from '@talelabs/ui/components/command'
import { Kbd } from '@talelabs/ui/components/kbd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { boardPreviews } from '../features/boards/board-data'

const pageActions: {
  hidden?: boolean
  icon: typeof IconPlus
  title: string
  url: string
}[] = [
  { icon: IconLayoutBoard, title: 'Boards', url: '/boards', hidden: true },
  { icon: IconWand, title: 'Generate', url: '/generate' },
  { icon: IconArchive, title: 'Assets', url: '/assets' },
  { icon: IconBriefcase, title: 'Projects', url: '/projects' },
  { icon: IconBuildingStore, title: 'Brands', url: '/brands' },
  { icon: IconPackage, title: 'Products', url: '/products' },
  { icon: IconUserSquareRounded, title: 'Characters', url: '/characters' },
  { icon: IconApps, title: 'Apps', url: '/apps', hidden: true },
  { icon: IconMovie, title: 'Studio', url: '/studio', hidden: true },
  { icon: IconSparkles, title: 'Assistant', url: '/assistant', hidden: true },
]

const settingsActions = [
  { icon: IconSettings, title: 'General settings', tab: 'general' },
  { icon: IconUserCircle, title: 'Profile', tab: 'profile' },
  { icon: IconUsersGroup, title: 'Invite member', tab: 'team' },
  { icon: IconCreditCard, title: 'Billing', tab: 'billing' },
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
          Search boards and actions...
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
        description="Search boards and actions."
        className="sm:max-w-[580px]"
      >
        <Command>
          <CommandInput placeholder="Search boards and actions..." />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Recent">
              {boardPreviews.map(board => (
                <CommandItem
                  key={board.title}
                  value={`${board.eyebrow} ${board.title}`}
                  onSelect={() => handleNavigate('/boards')}
                >
                  <IconLayoutBoard />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate">{board.title}</span>
                    <span className="
                      block truncate text-xs text-muted-foreground
                    "
                    >
                      {board.eyebrow.toLowerCase()}
                    </span>
                  </div>
                  <CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
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
            <CommandGroup heading="Quick actions">
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
              <CommandItem
                value="New board"
                onSelect={() => handleNavigate('/boards')}
              >
                <IconPlus />
                <span>New board</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
