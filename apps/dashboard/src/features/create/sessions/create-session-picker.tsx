/**
 * Compact navigation for durable direct Create sessions.
 *
 * The searchable picker exposes session identity and management without
 * reserving workspace width or owning any generation, draft, or Flow state.
 */

import type { CreateSession } from '@talelabs/sdk'

import {
  IconDots,
  IconEdit,
  IconMessage,
  IconMessagePlus,
  IconTrash,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@talelabs/ui/components/combobox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { Separator } from '@talelabs/ui/components/separator'
import { Spinner } from '@talelabs/ui/components/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { getResolvedLocale } from '../../../i18n/i18n'
import { useDebouncedSearch } from '../../search/use-debounced-search'
import { useCreateSessionListQuery } from '../data/create-session.queries'
import { DeleteCreateSessionDialog } from './delete-create-session-dialog'
import { RenameCreateSessionDialog } from './rename-create-session-dialog'

/** Renders the searchable session picker and current-session actions. */
export function CreateSessionPicker({
  currentSession,
  organizationId,
  onCreateNew,
}: {
  /** Durable session selected by the current route, when one exists. */
  currentSession: CreateSession | null
  /** Tenant used by rename and delete mutations. */
  organizationId: string
  /** Clears the unsaved draft when New is already the active route. */
  onCreateNew: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [renameSession, setRenameSession] = useState<CreateSession | null>(null)
  const [deleteSession, setDeleteSession] = useState<CreateSession | null>(null)
  const debouncedSearch = useDebouncedSearch(search)
  const query = useCreateSessionListQuery(debouncedSearch)
  const sessions = useMemo(
    () => query.data?.pages.flatMap(page => page.data) ?? [],
    [query.data?.pages],
  )

  const closePicker = () => {
    setOpen(false)
    setSearch('')
  }
  const createNew = () => {
    closePicker()
    if (currentSession)
      navigate('/create')
    else
      onCreateNew()
  }
  const handleDeleted = (sessionId: string) => {
    if (sessionId === currentSession?.id)
      navigate('/create', { replace: true })
  }

  return (
    <>
      <div className="absolute top-4 left-4 z-30">
        <div
          className="
            flex h-11 max-w-[calc(100vw-2rem)] min-w-0 items-center
            overflow-hidden rounded-xl
          "
          data-flow-chrome
        >
          <Combobox
            autoHighlight
            filter={null}
            inputValue={search}
            isItemEqualToValue={(session, selected) =>
              session.id === selected.id}
            itemToStringLabel={session =>
              session.name ?? t('create.sessions.untitled')}
            itemToStringValue={session => session.id}
            items={sessions}
            open={open}
            value={currentSession}
            onInputValueChange={setSearch}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen)
              if (!nextOpen)
                setSearch('')
            }}
            onValueChange={(session) => {
              if (session && session.id !== currentSession?.id)
                navigate(`/create/${session.id}`)
              closePicker()
            }}
          >
            <ComboboxTrigger
              className={`
                h-10 max-w-[calc(100vw-8rem)] min-w-0 rounded-none px-3
                sm:max-w-72
              `}
              render={<Button variant="ghost" />}
            >
              <span className="truncate">
                {currentSession?.name ?? t('create.sessions.untitled')}
              </span>
            </ComboboxTrigger>
            <ComboboxContent
              aria-label={t('create.sessions.title')}
              className={`
                w-[min(22rem,calc(100vw-1.5rem))] min-w-0 rounded-2xl border
                border-border/90 shadow-2xl
                *:data-[slot=input-group]:m-2 *:data-[slot=input-group]:mb-1
                *:data-[slot=input-group]:h-9
              `}
              align="start"
              sideOffset={8}
            >
              <ComboboxInput
                aria-label={t('create.sessions.search')}
                placeholder={t('create.sessions.searchPlaceholder')}
                showTrigger={false}
                variant="outline"
              />
              <ComboboxEmpty className="min-h-20 items-center px-4 py-6">
                {query.isPending
                  ? <Spinner className="size-5" />
                  : query.isError
                    ? (
                        <div className="flex flex-col gap-2 text-center">
                          <p>{t('create.sessions.actionFailed')}</p>
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => void query.refetch()}
                          >
                            {t('common.retry')}
                          </Button>
                        </div>
                      )
                    : (
                        debouncedSearch
                          ? t('create.sessions.noResults')
                          : t('create.sessions.empty')
                      )}
              </ComboboxEmpty>
              <ComboboxList className="max-h-80 px-2 pt-1 pb-2">
                <ComboboxCollection>
                  {(session: CreateSession) => {
                    const updatedAt = new Intl.DateTimeFormat(
                      getResolvedLocale(),
                      { dateStyle: 'medium' },
                    ).format(new Date(session.updatedAt))
                    return (
                      <ComboboxItem
                        className="min-h-14 gap-3 rounded-xl px-3 py-2"
                        key={session.id}
                        value={session}
                      >
                        <IconMessage
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            {session.name ?? t('create.sessions.untitled')}
                          </span>
                          <span className="
                            block truncate text-xs font-normal
                            text-muted-foreground
                          "
                          >
                            {updatedAt}
                          </span>
                        </span>
                      </ComboboxItem>
                    )
                  }}
                </ComboboxCollection>
              </ComboboxList>
              {query.hasNextPage && (
                <div className="border-t p-2">
                  <Button
                    className="w-full"
                    disabled={query.isFetchingNextPage}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => void query.fetchNextPage()}
                  >
                    {query.isFetchingNextPage && (
                      <Spinner data-icon="inline-start" />
                    )}
                    {query.isFetchingNextPage
                      ? t('common.loading')
                      : t('create.sessions.loadMore')}
                  </Button>
                </div>
              )}
            </ComboboxContent>
          </Combobox>
          <Separator
            className="
              h-5!
              data-vertical:self-center
            "
            orientation="vertical"
          />
          <Tooltip>
            <TooltipTrigger
              aria-label={t('create.sessions.new')}
              className="rounded-none"
              render={<Button size="icon-lg" variant="ghost" />}
              onClick={createNew}
            >
              <IconMessagePlus />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t('create.sessions.new')}
            </TooltipContent>
          </Tooltip>
          {currentSession && (
            <>
              <Separator
                className="
                  h-5!
                  data-vertical:self-center
                "
                orientation="vertical"
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t('common.moreOptions')}
                  className="rounded-none"
                  render={<Button size="icon-lg" variant="ghost" />}
                >
                  <IconDots />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => setRenameSession(currentSession)}
                    >
                      <IconEdit />
                      {t('create.sessions.rename')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteSession(currentSession)}
                    >
                      <IconTrash />
                      {t('create.sessions.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
      <RenameCreateSessionDialog
        organizationId={organizationId}
        session={renameSession}
        onOpenChange={nextOpen => !nextOpen && setRenameSession(null)}
      />
      <DeleteCreateSessionDialog
        organizationId={organizationId}
        session={deleteSession}
        onDeleted={handleDeleted}
        onOpenChange={nextOpen => !nextOpen && setDeleteSession(null)}
      />
    </>
  )
}
