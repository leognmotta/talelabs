import type { ElementType } from '@talelabs/elements'

import { IconComponents, IconPlus, IconSearch } from '@tabler/icons-react'
import { ELEMENT_TYPES } from '@talelabs/elements'
import { Button } from '@talelabs/ui/components/button'
import { ButtonGroup } from '@talelabs/ui/components/button-group'
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from '@talelabs/ui/components/select'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MediaLibraryGrid,
  MediaLibrarySkeleton,
} from '../../shared/components/media-library-card'
import { CreateElementDialog } from './create-element-dialog'
import { ElementCard } from './element-card'
import { elementTypeTranslationKey } from './element-i18n'
import { useElementListQuery } from './element.queries'

export function ElementsScreen() {
  const { t } = useTranslation()
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<ElementType | undefined>()
  const deferredSearch = useDeferredValue(search.trim())
  const query = useElementListQuery({ search: deferredSearch, type })
  const elements = query.data?.pages.flatMap(page => page.data) ?? []
  const filtered = Boolean(deferredSearch || type)
  const typeLabel = type
    ? t(elementTypeTranslationKey(type, 'label'))
    : t('elements.allTypes')

  return (
    <section className="flex min-h-[calc(100svh-8rem)] flex-col">
      <header className="flex flex-wrap items-center gap-3 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('navigation.elements')}</h1>
        </div>
        <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
          <IconPlus data-icon="inline-start" />
          {t('elements.create')}
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <InputGroup className="
          w-full bg-muted/50
          sm:w-72
        "
        >
          <InputGroupAddon>
            <IconSearch />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t('elements.search')}
            placeholder={t('elements.searchPlaceholder')}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </InputGroup>
        <ButtonGroup>
          <Select value={type ?? 'all'} onValueChange={value => setType(value === 'all' ? undefined : value as ElementType)}>
            <SelectTrigger
              aria-label={t('elements.filterByType')}
              size="sm"
            >
              <span>{typeLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{t('elements.allTypes')}</SelectItem>
                {ELEMENT_TYPES.map(elementType => (
                  <SelectItem key={elementType} value={elementType}>
                    {t(elementTypeTranslationKey(elementType, 'label'))}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </ButtonGroup>
      </div>
      {query.isPending
        ? <MediaLibrarySkeleton />
        : query.isError
          ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t('elements.couldNotLoad')}</EmptyTitle>
                  <EmptyDescription>{t('elements.couldNotLoadDescription')}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent><Button variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button></EmptyContent>
              </Empty>
            )
          : elements.length === 0
            ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><IconComponents /></EmptyMedia>
                    <EmptyTitle>{filtered ? t('elements.noResults') : t('elements.emptyTitle')}</EmptyTitle>
                    <EmptyDescription>{filtered ? t('elements.noResultsDescription') : t('elements.emptyDescription')}</EmptyDescription>
                  </EmptyHeader>
                  {!filtered && <EmptyContent><Button onClick={() => setCreateOpen(true)}>{t('elements.create')}</Button></EmptyContent>}
                </Empty>
              )
            : (
                <>
                  <MediaLibraryGrid className="py-5">
                    {elements.map(element => <ElementCard key={element.id} element={element} />)}
                  </MediaLibraryGrid>
                  {query.hasNextPage && (
                    <div className="flex justify-center">
                      <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                        {query.isFetchingNextPage ? t('common.loading') : t('elements.loadMore')}
                      </Button>
                    </div>
                  )}
                </>
              )}
      <CreateElementDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </section>
  )
}
