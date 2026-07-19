/**
 * One dialog that creates or edits an Element: name, kind, description, and
 * the ordered reference images. References reuse the canonical Asset picker.
 */

import type {
  ElementDetail,
  ElementKind,
  ElementReferenceAsset,
} from '@talelabs/sdk'
import type { ElementReferenceDraft } from './element-reference-picker-dialog'

import {
  IconArrowLeft,
  IconArrowRight,
  IconPhotoPlus,
  IconX,
} from '@tabler/icons-react'
import { MAX_ELEMENT_REFERENCES } from '@talelabs/assets'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { Input } from '@talelabs/ui/components/input'
import { Label } from '@talelabs/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@talelabs/ui/components/select'
import { Spinner } from '@talelabs/ui/components/spinner'
import { Textarea } from '@talelabs/ui/components/textarea'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ELEMENT_KINDS, elementKindLabelKey } from './element-kind-meta'
import { useElementMutations } from './element-mutations'
import { useElementDetailQuery } from './element-queries'
import { ElementReferencePickerDialog } from './element-reference-picker-dialog'

type ReferenceDraft = ElementReferenceDraft

function toReferenceDraft(
  asset: NonNullable<ElementReferenceAsset>,
): ReferenceDraft {
  return {
    id: asset.id,
    name: asset.name,
    thumbnailUrl: asset.thumbnailUrl ?? asset.url ?? null,
  }
}

function moveDraft(drafts: ReferenceDraft[], index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= drafts.length)
    return drafts
  const next = [...drafts]
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  return next
}

/** Creates a new Element or edits the Element identified by `elementId`. */
export function ElementEditorDialog({
  elementId,
  onOpenChange,
  open,
}: {
  elementId: null | string
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { t } = useTranslation()
  const detailQuery = useElementDetailQuery(open ? elementId : null)
  const editing = Boolean(elementId)
  const loading = editing && !detailQuery.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {editing ? t('elements.edit') : t('elements.create')}
          </DialogTitle>
          <DialogDescription>
            {t('elements.editorDescription')}
          </DialogDescription>
        </DialogHeader>
        {loading
          ? (
              <div className="flex justify-center py-12">
                <Spinner aria-label={t('common.loading')} />
              </div>
            )
          : (
              <ElementEditorForm
                initialDetail={detailQuery.data ?? null}
                key={detailQuery.data?.id ?? 'new'}
                onClose={() => onOpenChange(false)}
              />
            )}
      </DialogContent>
    </Dialog>
  )
}

/** Form state keyed by the loaded Element so props initialize local drafts. */
function ElementEditorForm({
  initialDetail,
  onClose,
}: {
  initialDetail: ElementDetail | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mutations = useElementMutations()
  const [name, setName] = useState(initialDetail?.name ?? '')
  const [kind, setKind] = useState<ElementKind>(
    initialDetail?.kind ?? 'character',
  )
  const [description, setDescription] = useState(
    initialDetail?.description ?? '',
  )
  const [references, setReferences] = useState<ReferenceDraft[]>(
    () => (initialDetail?.references ?? []).flatMap(reference =>
      reference ? [toReferenceDraft(reference)] : [],
    ),
  )
  const [pickerOpen, setPickerOpen] = useState(false)

  const editing = Boolean(initialDetail)
  const saving = mutations.create.isPending || mutations.update.isPending

  async function save() {
    const trimmedName = name.trim()
    if (!trimmedName)
      return
    const assetIds = references.map(reference => reference.id)
    try {
      if (initialDetail) {
        await mutations.update.mutateAsync({
          data: {
            assetIds,
            description: description.trim(),
            kind,
            name: trimmedName,
          },
          id: initialDetail.id,
        })
        toast.success(t('elements.updated'))
      }
      else {
        await mutations.create.mutateAsync({
          assetIds,
          description: description.trim() || undefined,
          kind,
          name: trimmedName,
        })
        toast.success(t('elements.created'))
      }
      onClose()
    }
    catch {
      toast.error(t('elements.saveFailed'))
    }
  }

  return (
    <>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="
          grid gap-3
          sm:grid-cols-[1fr_170px]
        "
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="element-name">{t('elements.name')}</Label>
            <Input
              autoFocus
              id="element-name"
              maxLength={120}
              placeholder={t('elements.namePlaceholder')}
              required
              value={name}
              onChange={event => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="element-kind">{t('elements.kind')}</Label>
            <Select
              value={kind}
              onValueChange={value => setKind(value as ElementKind)}
            >
              <SelectTrigger className="w-full" id="element-kind">
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
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="element-description">
            {t('elements.description')}
          </Label>
          <Textarea
            id="element-description"
            maxLength={2000}
            placeholder={t('elements.descriptionPlaceholder')}
            rows={3}
            value={description}
            onChange={event => setDescription(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>{t('elements.references')}</Label>
            <span className="text-xs text-muted-foreground">
              {t('elements.referenceProgress', {
                count: references.length,
                maximum: MAX_ELEMENT_REFERENCES,
              })}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {references.map((reference, index) => (
              <div
                className="
                  group relative aspect-square overflow-hidden rounded-lg
                  bg-muted ring-1 ring-border
                "
                key={reference.id}
              >
                {reference.thumbnailUrl && (
                  <img
                    alt={reference.name}
                    className="absolute inset-0 size-full object-cover"
                    src={reference.thumbnailUrl}
                  />
                )}
                {index === 0 && (
                  <span
                    className="
                      absolute bottom-1 left-1 rounded-sm bg-background/85
                      px-1.5 py-0.5 text-[10px] font-medium
                    "
                  >
                    {t('elements.cover')}
                  </span>
                )}
                <div
                  className="
                    absolute inset-x-0 top-0 flex justify-between gap-1 p-1
                    opacity-0 transition
                    group-focus-within:opacity-100
                    group-hover:opacity-100
                  "
                >
                  <span className="flex gap-1">
                    <Button
                      aria-label={t('elements.moveEarlier', {
                        name: reference.name,
                      })}
                      disabled={index === 0}
                      size="icon-xs"
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setReferences(current =>
                          moveDraft(current, index, -1),
                        )}
                    >
                      <IconArrowLeft aria-hidden />
                    </Button>
                    <Button
                      aria-label={t('elements.moveLater', {
                        name: reference.name,
                      })}
                      disabled={index === references.length - 1}
                      size="icon-xs"
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setReferences(current =>
                          moveDraft(current, index, 1),
                        )}
                    >
                      <IconArrowRight aria-hidden />
                    </Button>
                  </span>
                  <Button
                    aria-label={t('elements.removeReference', {
                      name: reference.name,
                    })}
                    size="icon-xs"
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setReferences(current =>
                        current.filter(item => item.id !== reference.id),
                      )}
                  >
                    <IconX aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
            {references.length < MAX_ELEMENT_REFERENCES && (
              <button
                aria-label={t('elements.addReferences')}
                className="
                  flex aspect-square flex-col items-center justify-center gap-1
                  rounded-lg border border-dashed text-muted-foreground
                  transition
                  hover:bg-muted/60 hover:text-foreground
                  focus-visible:ring-2 focus-visible:ring-ring
                "
                type="button"
                onClick={() => setPickerOpen(true)}
              >
                <IconPhotoPlus aria-hidden className="size-5" />
                <span className="text-[11px]">{t('common.add')}</span>
              </button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={saving || !name.trim()} type="submit">
            {saving
              ? t('common.loading')
              : editing
                ? t('common.save')
                : t('elements.create')}
          </Button>
        </DialogFooter>
      </form>
      <ElementReferencePickerDialog
        initialReferences={references}
        open={pickerOpen}
        onCommit={setReferences}
        onOpenChange={setPickerOpen}
      />
    </>
  )
}
