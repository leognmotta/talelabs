/** Route-level Element library: kind filter, search, cards, and dialogs. */

import type { Element, ElementKind } from '@talelabs/sdk'

import { IconPlus, IconSearch } from '@tabler/icons-react'
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@talelabs/ui/components/tabs'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  MediaLibraryGrid,
  MediaLibrarySkeleton,
} from '../../shared/components/media-library-card'
import { ElementIcon } from '../../shared/domain-icons'
import { DeleteElementDialog } from './delete-element-dialog'
import { ElementCard } from './element-card'
import { ElementEditorDialog } from './element-editor-dialog'
import { ELEMENT_KINDS, elementKindLabelKey } from './element-kind-meta'
import { ElementListLoadMore } from './element-list-load-more'
import { useElementListInfiniteQuery } from './element-queries'

/** Owns library filters and dialog targets; TanStack Query owns server state. */
export function ElementsScreen() {
  const { t } = useTranslation()
  const [kind, setKind] = useState<'all' | ElementKind>('all')
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingElementId, setEditingElementId] = useState<null | string>(null)
  const [deleteTarget, setDeleteTarget] = useState<Element | null>(null)
  const deferredSearch = useDeferredValue(search.trim())
  const query = useElementListInfiniteQuery({
    kind: kind === 'all' ? undefined : kind,
    search: deferredSearch || undefined,
  })
  const elements = query.data?.pages.flatMap(page => page.data) ?? []

  function openEditor(element: Element | null) {
    setEditingElementId(element?.id ?? null)
    setEditorOpen(true)
  }

  return (
    <section className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {t('navigation.elements')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('elements.libraryDescription')}
          </p>
        </div>
        <Button className="ml-auto" onClick={() => openEditor(null)}>
          <IconPlus data-icon="inline-start" />
          {t('elements.create')}
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-3 pb-5">
        <InputGroup className="
          w-full bg-muted/50
          sm:w-80
        "
        >
          <InputGroupAddon><IconSearch /></InputGroupAddon>
          <InputGroupInput
            aria-label={t('elements.search')}
            placeholder={t('elements.searchPlaceholder')}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </InputGroup>
        <Tabs
          value={kind}
          onValueChange={value => setKind(value as 'all' | ElementKind)}
        >
          <TabsList>
            <TabsTrigger value="all">{t('elements.allKinds')}</TabsTrigger>
            {ELEMENT_KINDS.map(item => (
              <TabsTrigger key={item} value={item}>
                {t(elementKindLabelKey(item))}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {query.isPending
        ? <MediaLibrarySkeleton />
        : query.isError
          ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t('elements.couldNotLoad')}</EmptyTitle>
                  <EmptyDescription>
                    {t('elements.couldNotLoadDescription')}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => void query.refetch()}>
                    {t('common.retry')}
                  </Button>
                </EmptyContent>
              </Empty>
            )
          : elements.length === 0
            ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><ElementIcon /></EmptyMedia>
                    <EmptyTitle>
                      {deferredSearch || kind !== 'all'
                        ? t('elements.noResults')
                        : t('elements.emptyTitle')}
                    </EmptyTitle>
                    <EmptyDescription>
                      {deferredSearch || kind !== 'all'
                        ? t('elements.noResultsDescription')
                        : t('elements.emptyDescription')}
                    </EmptyDescription>
                  </EmptyHeader>
                  {!deferredSearch && kind === 'all' && (
                    <EmptyContent>
                      <Button onClick={() => openEditor(null)}>
                        <IconPlus data-icon="inline-start" />
                        {t('elements.create')}
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              )
            : (
                <>
                  <MediaLibraryGrid className="py-5">
                    {elements.map(element => (
                      <ElementCard
                        element={element}
                        key={element.id}
                        onDelete={setDeleteTarget}
                        onOpen={item => openEditor(item)}
                      />
                    ))}
                  </MediaLibraryGrid>
                  <ElementListLoadMore
                    hasNextPage={query.hasNextPage}
                    isFetchingNextPage={query.isFetchingNextPage}
                    onLoadMore={() => void query.fetchNextPage()}
                  />
                </>
              )}
      <ElementEditorDialog
        elementId={editingElementId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
      <DeleteElementDialog
        element={deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
      />
    </section>
  )
}
