/**
 * Two-step Element chooser for the canvas node: pick an Element, then pick
 * exactly which of its references the node should output. Confirming always
 * writes an explicit reference choice — there is no implicit "all" mode.
 */

import type { Element, ElementDetail } from '@talelabs/sdk'

import { IconArrowLeft, IconCheck, IconSearch } from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@talelabs/ui/components/input-group'
import { Spinner } from '@talelabs/ui/components/spinner'
import { cn } from '@talelabs/ui/lib/utils'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ELEMENT_KIND_ICONS, elementKindLabelKey } from './element-kind-meta'
import { ElementListLoadMore } from './element-list-load-more'
import {
  useElementDetailQuery,
  useElementListInfiniteQuery,
} from './element-queries'

/** The node configuration produced by a confirmed pick. */
export interface ElementNodePick {
  element: Element
  elementId: string
  /** The Element's complete ordered reference list at pick time. */
  references: NonNullable<ElementDetail['references'][number]>[]
  selectedAssetIds: string[]
}

/** Step 1: searchable Element list reused as-is from the library queries. */
function ElementListStep({
  onPick,
  selectedElementId,
}: {
  onPick: (element: Element) => void
  selectedElementId: null | string
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim())
  const query = useElementListInfiniteQuery({
    search: deferredSearch || undefined,
  })
  const elements = query.data?.pages.flatMap(page => page.data) ?? []

  return (
    <>
      <InputGroup className="bg-muted/50">
        <InputGroupAddon><IconSearch /></InputGroupAddon>
        <InputGroupInput
          aria-label={t('elements.search')}
          placeholder={t('elements.searchPlaceholder')}
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
      </InputGroup>
      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {query.isPending && (
          <div className="flex justify-center py-8">
            <Spinner aria-label={t('common.loading')} />
          </div>
        )}
        {!query.isPending && elements.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {deferredSearch
              ? t('elements.noResults')
              : t('elements.emptyTitle')}
          </p>
        )}
        {elements.map((element) => {
          const KindIcon = ELEMENT_KIND_ICONS[element.kind]
          const coverUrl = element.coverAsset?.thumbnailUrl
            ?? element.coverAsset?.url
          return (
            <button
              className={cn(
                `
                  flex items-center gap-3 rounded-lg p-2 text-left transition
                  hover:bg-muted/60
                  focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:outline-none
                `,
                element.id === selectedElementId && 'bg-muted',
              )}
              key={element.id}
              type="button"
              onClick={() => onPick(element)}
            >
              <span className="
                flex size-11 shrink-0 items-center justify-center
                overflow-hidden rounded-md bg-muted ring-1 ring-border
              "
              >
                {coverUrl
                  ? <img alt="" className="size-full object-cover" src={coverUrl} />
                  : (
                      <KindIcon
                        aria-hidden
                        className="size-5 text-muted-foreground"
                      />
                    )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {element.name}
                </span>
                <span className="
                  mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground
                "
                >
                  <Badge variant="outline">
                    {t(elementKindLabelKey(element.kind))}
                  </Badge>
                  {t('elements.referenceCount', {
                    count: element.referenceCount,
                  })}
                </span>
              </span>
            </button>
          )
        })}
        <ElementListLoadMore
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      </div>
    </>
  )
}

/** Step 2: choose exactly which references this node outputs. */
function ReferenceSelectionStep({
  element,
  initialSelectedAssetIds,
  onBack,
  onConfirm,
}: {
  element: Element
  initialSelectedAssetIds: null | string[]
  onBack: () => void
  onConfirm: (
    references: NonNullable<ElementDetail['references'][number]>[],
    selectedAssetIds: string[],
  ) => void
}) {
  const { t } = useTranslation()
  const detailQuery = useElementDetailQuery(element.id)
  const references = (detailQuery.data?.references ?? [])
    .flatMap(reference => reference ? [reference] : [])
  const [selected, setSelected] = useState<null | Set<string>>(null)
  const selectedIds = selected ?? new Set(initialSelectedAssetIds ?? [])
  const selectedCount = references
    .filter(reference => selectedIds.has(reference.id))
    .length

  function toggle(assetId: string) {
    const next = new Set(selectedIds)
    if (next.has(assetId))
      next.delete(assetId)
    else
      next.add(assetId)
    setSelected(next)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          aria-label={t('common.back')}
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={onBack}
        >
          <IconArrowLeft aria-hidden />
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {element.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('elements.selectionSummary', {
            count: selectedCount,
            total: references.length,
          })}
        </span>
      </div>
      {detailQuery.isPending
        ? (
            <div className="flex justify-center py-10">
              <Spinner aria-label={t('common.loading')} />
            </div>
          )
        : detailQuery.isError
          ? (
              <div className="
                flex flex-col items-center gap-3 py-8 text-center text-sm
                text-muted-foreground
              "
              >
                {t('elements.couldNotLoad')}
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => void detailQuery.refetch()}
                >
                  {t('common.retry')}
                </Button>
              </div>
            )
          : references.length === 0
            ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t('elements.emptyNodeDescription')}
                </p>
              )
            : (
                <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto">
                  {references.map((reference) => {
                    const included = selectedIds.has(reference.id)
                    return (
                      <button
                        aria-label={included
                          ? t('elements.excludeReference', {
                              name: reference.name,
                            })
                          : t('elements.includeReference', {
                              name: reference.name,
                            })}
                        aria-pressed={included}
                        className={cn(
                          `
                            relative aspect-square overflow-hidden rounded-lg
                            bg-muted ring-1 ring-border transition
                            focus-visible:ring-2 focus-visible:ring-ring
                            focus-visible:outline-none
                          `,
                          !included && `
                            opacity-40
                            hover:opacity-70
                          `,
                        )}
                        key={reference.id}
                        type="button"
                        onClick={() => toggle(reference.id)}
                      >
                        {(reference.thumbnailUrl ?? reference.url) && (
                          <img
                            alt={reference.name}
                            className="absolute inset-0 size-full object-cover"
                            loading="lazy"
                            src={reference.thumbnailUrl
                              ?? reference.url
                              ?? undefined}
                          />
                        )}
                        {included && (
                          <span className="
                            absolute top-1 right-1 flex size-5 items-center
                            justify-center rounded-full bg-primary
                            text-primary-foreground shadow-sm
                          "
                          >
                            <IconCheck aria-hidden className="size-3.5" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          {t('common.back')}
        </Button>
        <Button
          disabled={detailQuery.isPending
            || detailQuery.isError
            || selectedCount === 0}
          type="button"
          onClick={() => onConfirm(
            references,
            references
              .filter(reference => selectedIds.has(reference.id))
              .map(reference => reference.id),
          )}
        >
          {t('elements.pickerConfirm', { count: selectedCount })}
        </Button>
      </DialogFooter>
    </>
  )
}

/** Owns the two-step flow; the caller receives one confirmed pick. */
export function ElementNodePickerDialog({
  currentElementId,
  currentSelectedAssetIds,
  onConfirm,
  onOpenChange,
  open,
}: {
  currentElementId: null | string
  currentSelectedAssetIds: null | string[]
  onConfirm: (pick: ElementNodePick) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { t } = useTranslation()
  const [pickedElement, setPickedElement] = useState<Element | null>(null)

  function close(value: boolean) {
    if (!value)
      setPickedElement(null)
    onOpenChange(value)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {pickedElement
              ? t('elements.pickReferencesTitle')
              : t('elements.choose')}
          </DialogTitle>
          <DialogDescription>
            {pickedElement
              ? t('elements.pickReferencesDescription')
              : t('elements.chooseDescription')}
          </DialogDescription>
        </DialogHeader>
        {pickedElement
          ? (
              <ReferenceSelectionStep
                element={pickedElement}
                initialSelectedAssetIds={
                  pickedElement.id === currentElementId
                    ? currentSelectedAssetIds
                    : null
                }
                key={pickedElement.id}
                onBack={() => setPickedElement(null)}
                onConfirm={(references, selectedAssetIds) => {
                  onConfirm({
                    element: pickedElement,
                    elementId: pickedElement.id,
                    references,
                    selectedAssetIds,
                  })
                  close(false)
                }}
              />
            )
          : (
              <ElementListStep
                selectedElementId={currentElementId}
                onPick={setPickedElement}
              />
            )}
      </DialogContent>
    </Dialog>
  )
}
