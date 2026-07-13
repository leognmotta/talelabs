import type { ElementListItem } from '@talelabs/sdk'

import { IconComponents, IconSearch } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import {
  Empty,
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
import { elementTypeTranslationKey } from '../elements/element-i18n'
import { ELEMENT_TYPE_ICONS } from '../elements/element-type-icons'
import { useElementListQuery } from '../elements/element.queries'

function ElementPickerItem({
  element,
  onSelect,
}: {
  element: ElementListItem
  onSelect: (element: ElementListItem) => void
}) {
  const { t } = useTranslation()
  const Icon = ELEMENT_TYPE_ICONS[element.type]
  return (
    <button
      className="
        group flex min-w-0 flex-col gap-2 rounded-2xl p-2 text-left outline-none
        hover:bg-muted
        focus-visible:ring-2 focus-visible:ring-ring
      "
      type="button"
      onClick={() => onSelect(element)}
    >
      <div className="
        flex aspect-square w-full items-center justify-center overflow-hidden
        rounded-xl bg-muted ring-1 ring-foreground/5
      "
      >
        {element.previewThumbnailUrl
          ? <img alt="" className="size-full object-contain" src={element.previewThumbnailUrl} />
          : <Icon className="size-8 text-muted-foreground" />}
      </div>
      <div className="min-w-0 px-1">
        <p className="truncate text-sm font-medium">{element.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {t(elementTypeTranslationKey(element.type, 'label'))}
        </p>
      </div>
    </button>
  )
}

export function ElementPickerDialog({
  onOpenChange,
  onSelect,
  open,
}: {
  onOpenChange: (open: boolean) => void
  onSelect: (element: ElementListItem) => void
  open: boolean
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const query = useElementListQuery({ search: deferredSearch })
  const elements = query.data?.pages.flatMap(page => page.data) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          flex max-h-[85svh] flex-col
          sm:max-w-4xl
        "
        closeLabel={t('common.close')}
      >
        <DialogHeader>
          <DialogTitle>{t('flows.elementPicker.title')}</DialogTitle>
          <DialogDescription>{t('flows.elementPicker.description')}</DialogDescription>
        </DialogHeader>
        <InputGroup className="bg-muted/50">
          <InputGroupAddon><IconSearch /></InputGroupAddon>
          <InputGroupInput
            aria-label={t('flows.elementPicker.search')}
            placeholder={t('flows.elementPicker.searchPlaceholder')}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </InputGroup>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {query.isPending
            ? <p className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
            : query.isError
              ? (
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><IconComponents /></EmptyMedia>
                      <EmptyTitle>{t('flows.elementPicker.couldNotLoad')}</EmptyTitle>
                      <EmptyDescription>
                        {t('flows.elementPicker.couldNotLoadDescription')}
                      </EmptyDescription>
                    </EmptyHeader>
                    <Button variant="outline" onClick={() => void query.refetch()}>
                      {t('common.retry')}
                    </Button>
                  </Empty>
                )
              : elements.length === 0
                ? (
                    <Empty className="py-12">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><IconComponents /></EmptyMedia>
                        <EmptyTitle>{t('flows.elementPicker.noResults')}</EmptyTitle>
                        <EmptyDescription>{t('flows.elementPicker.noResultsDescription')}</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )
                : (
                    <div className="
                      grid grid-cols-2 gap-2
                      sm:grid-cols-4
                    "
                    >
                      {elements.map(element => (
                        <ElementPickerItem element={element} key={element.id} onSelect={onSelect} />
                      ))}
                    </div>
                  )}
        </div>
        {query.hasNextPage && (
          <Button
            className="self-center"
            disabled={query.isFetchingNextPage}
            variant="outline"
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? t('common.loading') : t('elements.loadMore')}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
