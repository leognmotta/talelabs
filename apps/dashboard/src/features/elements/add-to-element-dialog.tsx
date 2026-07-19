/**
 * Shared "Add to Element" flow used by the Assets library, the Asset viewer,
 * and generation-node outputs. Appends the given image Assets to an existing
 * Element or creates a new one, always confirming with resulting counts.
 */

import type { Element, ElementKind } from '@talelabs/sdk'

import { IconPlus, IconSearch } from '@tabler/icons-react'
import { MAX_ELEMENT_REFERENCES } from '@talelabs/assets'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { Input } from '@talelabs/ui/components/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@talelabs/ui/components/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@talelabs/ui/components/select'
import { Spinner } from '@talelabs/ui/components/spinner'
import { cn } from '@talelabs/ui/lib/utils'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ELEMENT_KIND_ICONS, ELEMENT_KINDS, elementKindLabelKey } from './element-kind-meta'
import { ElementListLoadMore } from './element-list-load-more'
import { useElementMutations } from './element-mutations'
import { useElementListInfiniteQuery } from './element-queries'

/** Appends `assetIds` to a chosen or newly created Element. */
export function AddToElementDialog({
  assetIds,
  onOpenChange,
  open,
}: {
  assetIds: readonly string[]
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { t } = useTranslation()
  const mutations = useElementMutations()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<ElementKind>('character')
  const [busyElementId, setBusyElementId] = useState<null | string>(null)
  const deferredSearch = useDeferredValue(search.trim())
  const query = useElementListInfiniteQuery({
    search: deferredSearch || undefined,
  })
  const elements = query.data?.pages.flatMap(page => page.data) ?? []

  function close() {
    setSearch('')
    setCreating(false)
    setNewName('')
    onOpenChange(false)
  }

  async function addToExisting(element: Element) {
    setBusyElementId(element.id)
    try {
      // One atomic server-side append: no read-then-replace race, and the
      // response states exactly which Assets were accepted.
      const result = await mutations.mutateReferences.mutateAsync({
        add: assetIds.slice(0, MAX_ELEMENT_REFERENCES) as string[],
        id: element.id,
      })
      const added = result.addedAssetIds
      if (added.length === 0) {
        const presentIds = new Set(result.references
          .flatMap(reference => reference ? [reference.id] : []))
        if (assetIds.every(id => presentIds.has(id))) {
          toast.info(t('elements.alreadyInElement', { name: element.name }))
          close()
        }
        else {
          toast.error(t('elements.pickerAtCapacity', {
            maximum: MAX_ELEMENT_REFERENCES,
          }))
        }
        return
      }
      toast.success(
        t('elements.addedToElement', {
          count: added.length,
          maximum: MAX_ELEMENT_REFERENCES,
          name: element.name,
          total: result.referenceCount,
        }),
        {
          action: {
            label: t('common.undo'),
            // Undo removes only the Assets this call added, so it never
            // erases edits made by anyone else in the meantime.
            onClick: () => void mutations.mutateReferences.mutateAsync({
              id: element.id,
              remove: added,
            }),
          },
        },
      )
      close()
    }
    catch {
      toast.error(t('elements.saveFailed'))
    }
    finally {
      setBusyElementId(null)
    }
  }

  async function createNew() {
    const trimmed = newName.trim()
    if (!trimmed)
      return
    try {
      await mutations.create.mutateAsync({
        assetIds: assetIds.slice(0, MAX_ELEMENT_REFERENCES) as string[],
        kind: newKind,
        name: trimmed,
      })
      toast.success(
        t('elements.addedToElement', {
          count: Math.min(assetIds.length, MAX_ELEMENT_REFERENCES),
          maximum: MAX_ELEMENT_REFERENCES,
          name: trimmed,
          total: Math.min(assetIds.length, MAX_ELEMENT_REFERENCES),
        }),
      )
      close()
    }
    catch {
      toast.error(t('elements.saveFailed'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => (value ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {t('elements.addToElement', { count: assetIds.length })}
          </DialogTitle>
          <DialogDescription>
            {t('elements.addToElementDescription')}
          </DialogDescription>
        </DialogHeader>
        <InputGroup className="bg-muted/50">
          <InputGroupAddon><IconSearch /></InputGroupAddon>
          <InputGroupInput
            aria-label={t('elements.search')}
            placeholder={t('elements.searchPlaceholder')}
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </InputGroup>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {query.isPending && (
            <div className="flex justify-center py-6">
              <Spinner aria-label={t('common.loading')} />
            </div>
          )}
          {elements.map((element) => {
            const KindIcon = ELEMENT_KIND_ICONS[element.kind]
            const coverUrl = element.coverAsset?.thumbnailUrl
              ?? element.coverAsset?.url
            const full = element.referenceCount >= MAX_ELEMENT_REFERENCES
            return (
              <button
                className={cn(
                  `
                    flex items-center gap-3 rounded-lg p-2 text-left transition
                    hover:bg-muted/60
                    focus-visible:ring-2 focus-visible:ring-ring
                    focus-visible:outline-none
                  `,
                  (full || busyElementId !== null) && 'opacity-50',
                )}
                disabled={full || busyElementId !== null}
                key={element.id}
                title={full
                  ? t('elements.pickerAtCapacity', {
                      maximum: MAX_ELEMENT_REFERENCES,
                    })
                  : undefined}
                type="button"
                onClick={() => void addToExisting(element)}
              >
                <span className="
                  flex size-10 shrink-0 items-center justify-center
                  overflow-hidden rounded-md bg-muted ring-1 ring-border
                "
                >
                  {busyElementId === element.id
                    ? <Spinner aria-label={t('common.loading')} />
                    : coverUrl
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
                    mt-0.5 flex items-center gap-1.5 text-xs
                    text-muted-foreground
                  "
                  >
                    <Badge variant="outline">
                      {t(elementKindLabelKey(element.kind))}
                    </Badge>
                    {t('elements.capacity', {
                      count: element.referenceCount,
                      maximum: MAX_ELEMENT_REFERENCES,
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
        {creating
          ? (
              <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void createNew()
                }}
              >
                <div className="min-w-0 flex-1">
                  <Input
                    autoFocus
                    aria-label={t('elements.name')}
                    maxLength={120}
                    placeholder={t('elements.namePlaceholder')}
                    required
                    value={newName}
                    onChange={event => setNewName(event.target.value)}
                  />
                </div>
                <Select
                  value={newKind}
                  onValueChange={value => setNewKind(value as ElementKind)}
                >
                  <SelectTrigger
                    aria-label={t('elements.kind')}
                    className="w-32"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ELEMENT_KINDS.map(item => (
                      <SelectItem key={item} value={item}>
                        {t(elementKindLabelKey(item))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!newName.trim() || mutations.create.isPending}
                  type="submit"
                >
                  {t('elements.create')}
                </Button>
              </form>
            )
          : (
              <Button
                className="justify-start"
                type="button"
                variant="outline"
                onClick={() => setCreating(true)}
              >
                <IconPlus data-icon="inline-start" />
                {t('elements.newElement')}
              </Button>
            )}
      </DialogContent>
    </Dialog>
  )
}
