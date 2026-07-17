/** Global command palette for pages, Settings, folders, and Assets. */

import type { ReactNode } from 'react'
import type { SettingsTab } from '../features/settings/settings-state'

import {
  IconAlertCircle,
  IconBuilding,
  IconGitBranch,
  IconKey,
  IconRefresh,
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
import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useAssetViewerUrlState } from '../features/assets/viewer/use-asset-viewer-url-state'
import {
  GLOBAL_SEARCH_MIN_LENGTH,
  GLOBAL_SEARCH_RESULT_LIMIT,
} from '../features/search/search.constants'
import { useDebouncedSearch } from '../features/search/use-debounced-search'
import { useWorkspaceSearchQuery } from '../features/search/use-workspace-search-query'
import { AssetIcon } from '../shared/domain-icons'
import { GlobalSearchAssetThumbnail } from './global-search-asset-thumbnail'
import { GlobalSearchFolderThumbnail } from './global-search-folder-thumbnail'

const pageActions: {
  hidden?: boolean
  icon: typeof AssetIcon
  titleKey: 'navigation.assets' | 'navigation.flows'
  url: string
}[] = [
  { icon: AssetIcon, titleKey: 'navigation.assets', url: '/assets' },
  { icon: IconGitBranch, titleKey: 'navigation.flows', url: '/flows' },
]

const settingsActions = [
  { icon: IconSettings, titleKey: 'navigation.generalSettings', tab: 'general' },
  { icon: IconBuilding, titleKey: 'navigation.organizationSettings', tab: 'organization' },
  { icon: IconUserCircle, titleKey: 'navigation.profile', tab: 'profile' },
  { icon: IconUsersGroup, titleKey: 'navigation.inviteMember', tab: 'team' },
  { icon: IconKey, titleKey: 'settings.secureStore', tab: 'secureStore' },
] satisfies {
  icon: typeof IconSettings
  titleKey: 'navigation.generalSettings' | 'navigation.inviteMember' | 'navigation.organizationSettings' | 'navigation.profile' | 'settings.secureStore'
  tab: SettingsTab
}[]

function normalizeCommandText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLocaleLowerCase()
    .trim()
}

function matchesCommand(search: string, value: string) {
  const terms = normalizeCommandText(search).split(/\s+/).filter(Boolean)
  const normalizedValue = normalizeCommandText(value)
  return terms.every(term => normalizedValue.includes(term))
}

/** Renders the Cmd-K search surface and routes selected results. */
export function GlobalSearch({
  onOpenInviteMemberSettings,
  onOpenSettings,
}: {
  onOpenInviteMemberSettings: () => void
  onOpenSettings: (tab?: SettingsTab) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { assetId, closeAsset, openAsset } = useAssetViewerUrlState()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const normalizedSearch = search.trim()
  const debouncedSearch = useDebouncedSearch(search)
  const searchQuery = useWorkspaceSearchQuery(debouncedSearch, open)
  const shortcutLabel = /Mac|iPhone|iPad|iPod/.test(window.navigator.platform)
    ? '⌘K'
    : 'Ctrl K'
  const visiblePageActions = pageActions
    .filter(action => !action.hidden)
    .filter(action => matchesCommand(search, t(action.titleKey)))
  const visibleSettingsActions = settingsActions
    .filter(action => matchesCommand(search, t(action.titleKey)))
  const remoteSearchReady = normalizedSearch.length >= GLOBAL_SEARCH_MIN_LENGTH
    && normalizedSearch === debouncedSearch
  const visibleFolders = remoteSearchReady
    ? (searchQuery.data?.folders ?? []).slice(0, GLOBAL_SEARCH_RESULT_LIMIT)
    : []
  const visibleAssets = remoteSearchReady
    ? (searchQuery.data?.assets ?? []).slice(0, GLOBAL_SEARCH_RESULT_LIMIT)
    : []
  const loading = normalizedSearch.length >= GLOBAL_SEARCH_MIN_LENGTH
    && (!remoteSearchReady || searchQuery.isFetching)
  const searchFailed = remoteSearchReady && searchQuery.isError

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k')
        return

      event.preventDefault()
      if (assetId) {
        closeAsset()
        setOpen(true)
        return
      }

      setOpen(currentOpen => !currentOpen)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [assetId, closeAsset])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen)
      setSearch('')
  }

  function closeSearch() {
    setOpen(false)
    setSearch('')
  }

  function handleNavigate(url: string) {
    closeSearch()
    navigate(url)
  }

  function handleOpenSettings(tab: SettingsTab) {
    closeSearch()

    if (tab === 'team')
      onOpenInviteMemberSettings()
    else
      onOpenSettings(tab)
  }

  const groups: { id: string, node: ReactNode }[] = []

  if (visiblePageActions.length > 0) {
    groups.push({
      id: 'pages',
      node: (
        <CommandGroup heading={t('search.pages')}>
          {visiblePageActions.map((action) => {
            const Icon = action.icon

            return (
              <CommandItem
                key={action.titleKey}
                value={`page:${action.url}`}
                onSelect={() => handleNavigate(action.url)}
              >
                <Icon />
                <span>{t(action.titleKey)}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      ),
    })
  }

  if (visibleSettingsActions.length > 0) {
    groups.push({
      id: 'settings',
      node: (
        <CommandGroup heading={t('search.settings')}>
          {visibleSettingsActions.map((action) => {
            const Icon = action.icon

            return (
              <CommandItem
                key={action.titleKey}
                value={`settings:${action.tab}`}
                onSelect={() => handleOpenSettings(action.tab)}
              >
                <Icon />
                <span>{t(action.titleKey)}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      ),
    })
  }

  if (visibleFolders.length > 0) {
    groups.push({
      id: 'folders',
      node: (
        <CommandGroup heading={t('assets.folders')}>
          {visibleFolders.map(folder => (
            <CommandItem
              className="py-2.5"
              key={folder.id}
              value={`folder:${folder.id}`}
              onSelect={() => handleNavigate(`/assets?folder=${folder.id}`)}
            >
              <GlobalSearchFolderThumbnail />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{folder.name}</span>
                <span
                  className="
                    block truncate text-xs font-normal text-muted-foreground
                  "
                  title={folder.path}
                >
                  {folder.path}
                </span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      ),
    })
  }

  if (visibleAssets.length > 0) {
    groups.push({
      id: 'assets',
      node: (
        <CommandGroup heading={t('navigation.assets')}>
          {visibleAssets.map(asset => (
            <CommandItem
              className="py-2.5"
              key={asset.id}
              value={`asset:${asset.id}`}
              onSelect={() => {
                closeSearch()
                openAsset(asset.id)
              }}
            >
              <GlobalSearchAssetThumbnail asset={asset} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{asset.name}</span>
                <span className="
                  block text-xs font-normal text-muted-foreground
                "
                >
                  {t(`assets.types.${asset.type}`)}
                </span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      ),
    })
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
        className="sm:max-w-[620px]"
        description={t('search.description')}
        open={open}
        title={t('search.title')}
        onOpenChange={handleOpenChange}
      >
        <Command loop shouldFilter={false}>
          <CommandInput
            loading={loading}
            placeholder={t('search.placeholder')}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[min(560px,70svh)]">
            {searchFailed && (
              <div
                className="
                  m-1.5 flex items-center gap-3 rounded-2xl border
                  border-destructive/30 bg-destructive/5 p-3
                "
                role="alert"
              >
                <IconAlertCircle
                  aria-hidden
                  className="size-5 shrink-0 text-destructive"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t('search.couldNotSearch')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('search.couldNotSearchDescription')}
                  </p>
                </div>
                <Button
                  disabled={searchQuery.isFetching}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => void searchQuery.refetch()}
                >
                  <IconRefresh data-icon="inline-start" />
                  {t('common.retry')}
                </Button>
              </div>
            )}
            {!loading && !searchFailed && (
              <CommandEmpty>{t('search.empty')}</CommandEmpty>
            )}
            {groups.map((group, index) => (
              <Fragment key={group.id}>
                {index > 0 && <CommandSeparator alwaysRender />}
                {group.node}
              </Fragment>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
