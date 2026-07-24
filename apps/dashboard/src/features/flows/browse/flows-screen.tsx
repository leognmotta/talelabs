/** Route-level Flow list, pagination, and create/rename/delete dialog composition. */

import type { Flow } from '@talelabs/sdk'
import { IconGitBranch, IconPlus, IconSearch } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@talelabs/ui/components/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@talelabs/ui/components/input-group'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MediaLibraryGrid,
  MediaLibrarySkeleton,
} from '../../../shared/components/media-library-card'
import { useFlowListQuery } from '../data/flow-list.query'
import { CreateFlowDialog } from './create-flow-dialog'
import { DeleteFlowDialog } from './delete-flow-dialog'
import { FlowCard } from './flow-card'
import { RenameFlowDialog } from './rename-flow-dialog'

/** Owns browse-screen dialog targets while TanStack Query owns Flow server state. */
export function FlowsScreen() {
  const { t } = useTranslation()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteFlow, setDeleteFlow] = useState<Flow | null>(null)
  const [renameFlow, setRenameFlow] = useState<Flow | null>(null)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const query = useFlowListQuery(deferredSearch)
  const flows = query.data?.pages.flatMap(page => page.data) ?? []

  return (
    <section className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {t('navigation.flows')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('flows.description')}
          </p>
        </div>
        <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
          <IconPlus data-icon="inline-start" />
          {t('flows.create')}
        </Button>
      </header>
      <div className="pb-5">
        <InputGroup className="
          w-full bg-muted/50
          sm:w-80
        "
        >
          <InputGroupAddon><IconSearch /></InputGroupAddon>
          <InputGroupInput
            aria-label={t('flows.search')}
            placeholder={t('flows.searchPlaceholder')}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </InputGroup>
      </div>
      {query.isPending
        ? <MediaLibrarySkeleton />
        : query.isError
          ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t('flows.couldNotLoad')}</EmptyTitle>
                  <EmptyDescription>{t('flows.couldNotLoadDescription')}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => void query.refetch()}>
                    {t('common.retry')}
                  </Button>
                </EmptyContent>
              </Empty>
            )
          : flows.length === 0
            ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><IconGitBranch /></EmptyMedia>
                    <EmptyTitle>
                      {deferredSearch ? t('flows.noResults') : t('flows.emptyTitle')}
                    </EmptyTitle>
                    <EmptyDescription>
                      {deferredSearch
                        ? t('flows.noResultsDescription')
                        : t('flows.emptyDescription')}
                    </EmptyDescription>
                  </EmptyHeader>
                  {!deferredSearch && (
                    <EmptyContent>
                      <Button onClick={() => setCreateOpen(true)}>
                        <IconPlus data-icon="inline-start" />
                        {t('flows.create')}
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              )
            : (
                <>
                  <MediaLibraryGrid className="py-5">
                    {flows.map(flow => (
                      <FlowCard
                        key={flow.id}
                        flow={flow}
                        onDelete={setDeleteFlow}
                        onRename={setRenameFlow}
                      />
                    ))}
                  </MediaLibraryGrid>
                  {query.hasNextPage && (
                    <div className="flex justify-center pt-6">
                      <Button
                        disabled={query.isFetchingNextPage}
                        variant="outline"
                        onClick={() => void query.fetchNextPage()}
                      >
                        {query.isFetchingNextPage
                          ? t('common.loading')
                          : t('flows.loadMore')}
                      </Button>
                    </div>
                  )}
                </>
              )}
      <CreateFlowDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RenameFlowDialog
        flow={renameFlow}
        onOpenChange={open => !open && setRenameFlow(null)}
      />
      <DeleteFlowDialog
        flow={deleteFlow}
        onOpenChange={open => !open && setDeleteFlow(null)}
      />
    </section>
  )
}
