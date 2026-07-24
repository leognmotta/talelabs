/** Capability-driven Asset attachment roles for the current Create request. */

import type { GenerationInputSlotDefinition } from '@talelabs/flows'
import type { Asset } from '@talelabs/sdk'
import type { CreateDraft } from './create-draft'
import type { CreateDraftResolution } from './create-resolution'

import {
  IconArrowLeft,
  IconArrowRight,
  IconFolderOpen,
  IconLock,
  IconPlus,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { getAssetsId } from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { useFoldersQuery } from '../assets/data/folder-query'
import { AssetLibraryDialog } from '../assets/library/asset-library-dialog'
import { useAssetLibraryUpload } from '../assets/library/use-asset-library-upload'
import { AssetMediaPreview } from '../assets/media/asset-media-preview'
import { useAssetViewerUrlState } from '../assets/viewer/use-asset-viewer-url-state'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { uploadStore } from '../uploads/upload-store'
import {
  createAttachment,
  toCreateAssetReference,
} from './create-draft'
import {
  canAddCreateAttachment,
  createAssetMatchesInputSlot,
  createInputSlotAssetTypes,
  isCreateInputSlotAddable,
} from './create-resolution'

function fileMatchesSlot(
  file: File,
  slot: GenerationInputSlotDefinition,
) {
  const assetType = file.type.startsWith('image/')
    ? 'image'
    : file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
        ? 'audio'
        : null

  return assetType !== null && createAssetMatchesInputSlot({
    mimeType: file.type,
    type: assetType,
  }, slot)
}

function slotFileAccept(slot: GenerationInputSlotDefinition) {
  if (slot.acceptedMedia?.mimeTypes.length)
    return slot.acceptedMedia.mimeTypes.join(',')
  return createInputSlotAssetTypes(slot).map(type => `${type}/*`).join(',')
}

/** Renders semantic attachment fields and reuses the global Asset picker. */
export function CreateAttachments({
  draft,
  resolution,
  onAdd,
  onRemove,
  onReorder,
}: {
  /** Current request with stable browser-local attachment identities. */
  draft: CreateDraft
  /** Existing catalog resolution defining visible semantic slots. */
  resolution: CreateDraftResolution
  /** Adds one canonical Asset to a semantic slot. */
  onAdd: (attachment: ReturnType<typeof createAttachment>) => void
  /** Atomically removes one attachment and its affected prompt token. */
  onRemove: (attachmentId: string) => void
  /** Reorders stable attachment identities without retargeting prompt tokens. */
  onReorder: (attachmentIds: string[]) => void
}) {
  const { t } = useTranslation()
  const viewer = useAssetViewerUrlState()
  const organizationId = useActiveOrganizationId()
  const foldersQuery = useFoldersQuery()
  const [pickerSlotId, setPickerSlotId] = useState<null | string>(null)
  const draftRef = useRef(draft)
  const resolutionRef = useRef(resolution)
  const onAddRef = useRef(onAdd)
  const uploadSlotIdRef = useRef<null | string>(null)
  const ownUploadBatchesRef = useRef(new Map<string, string>())
  const joinedUploadAssetIdsRef = useRef(new Set<string>())
  draftRef.current = draft
  resolutionRef.current = resolution
  onAddRef.current = onAdd
  const attachmentSlots = useMemo(
    () => resolution.slots.filter(
      slot => createInputSlotAssetTypes(slot).length > 0,
    ),
    [resolution.slots],
  )
  const pickerSlot = attachmentSlots.find(slot => slot.id === pickerSlotId)
  const pickerAllowedTypes = useMemo(
    () => pickerSlot ? createInputSlotAssetTypes(pickerSlot) : [],
    [pickerSlot],
  )
  const addableSlots = attachmentSlots.filter(slot => (
    isCreateInputSlotAddable({ draft, resolution, slotId: slot.id })
  ))
  const singleSlot = attachmentSlots.length === 1
    ? attachmentSlots[0]!
    : null
  const folders = useMemo(
    () => foldersQuery.data?.data ?? [],
    [foldersQuery.data?.data],
  )
  const upload = useAssetLibraryUpload({
    folderId: null,
    folders,
    onBatchEnqueued: (batchId) => {
      const slotId = uploadSlotIdRef.current
      if (slotId)
        ownUploadBatchesRef.current.set(batchId, slotId)
    },
  })

  useEffect(() => {
    if (!organizationId)
      return
    const controller = new AbortController()

    return uploadStore.subscribe((state) => {
      const completed = Object.values(state.items).filter(item => (
        item.status === 'completed'
        && item.assetId
        && ownUploadBatchesRef.current.has(item.batchId)
        && !joinedUploadAssetIdsRef.current.has(item.assetId)
      ))

      for (const item of completed) {
        const assetId = item.assetId!
        const slotId = ownUploadBatchesRef.current.get(item.batchId)
        joinedUploadAssetIdsRef.current.add(assetId)
        if (!slotId)
          continue

        void getAssetsId(
          { id: assetId },
          {
            headers: getOrganizationRequestHeaders(organizationId),
            signal: controller.signal,
          },
        ).then((asset) => {
          if (controller.signal.aborted)
            return
          const slot = resolutionRef.current.slots.find(
            candidate => candidate.id === slotId,
          )
          const currentAttachments = draftRef.current.attachments.filter(
            attachment => attachment.slotId === slotId,
          )
          if (
            !slot
            || currentAttachments.length >= slot.maxItems
            || currentAttachments.some(
              attachment => attachment.asset.id === asset.id,
            )
          ) {
            return
          }
          const reference = toCreateAssetReference(asset)
          if (reference) {
            const attachment = createAttachment(reference, slotId)
            if (!canAddCreateAttachment(draftRef.current, attachment))
              return
            onAddRef.current(attachment)
            if (currentAttachments.length + 1 >= slot.maxItems) {
              setPickerSlotId(current => current === slotId ? null : current)
            }
          }
        }).catch((error) => {
          if (!controller.signal.aborted) {
            console.error('Uploaded Create attachment could not be loaded.', {
              assetId,
              error,
            })
          }
        })
      }
    })
  }, [organizationId])

  function openUpload(slot: GenerationInputSlotDefinition) {
    if (!isCreateInputSlotAddable({
      draft,
      resolution,
      slotId: slot.id,
    })) {
      return
    }
    const input = upload.fileInputRef.current
    if (!input)
      return
    const count = draft.attachments.filter(
      attachment => attachment.slotId === slot.id,
    ).length
    input.accept = slotFileAccept(slot)
    input.multiple = slot.maxItems - count > 1
    uploadSlotIdRef.current = slot.id
    input.click()
  }

  function uploadFiles(files: FileList | null) {
    const slotId = uploadSlotIdRef.current
    const slot = attachmentSlots.find(candidate => candidate.id === slotId)
    if (
      !slot
      || !files
      || !isCreateInputSlotAddable({ draft, resolution, slotId: slot.id })
    ) {
      return
    }
    const count = draft.attachments.filter(
      attachment => attachment.slotId === slot.id,
    ).length
    const accepted = Array.from(files)
      .filter(file => fileMatchesSlot(file, slot))
      .slice(0, Math.max(0, slot.maxItems - count))
    if (accepted.length === 0) {
      toast.error(t('create.attachments.wrongFormat'))
      return
    }
    upload.uploadFiles(accepted)
    uploadSlotIdRef.current = null
  }

  function slotUnavailableReason(slot: GenerationInputSlotDefinition) {
    const availability = resolution.inputAvailability[slot.id]
    if (
      availability?.state === 'blocked'
      || availability?.state === 'full'
    ) {
      return t(availability.reasonKey, {
        count: slot.maxItems,
        maximum: slot.maxItems,
      })
    }
    return t('create.attachments.atCapacity', {
      maximum: slot.maxItems,
    })
  }

  function moveAttachment(attachmentId: string, direction: -1 | 1) {
    const index = draft.attachments.findIndex(
      item => item.attachmentId === attachmentId,
    )
    const attachment = draft.attachments[index]
    if (!attachment)
      return
    const candidateIndex = direction < 0
      ? draft.attachments.findLastIndex(
          (item, candidate) => candidate < index
            && item.slotId === attachment.slotId,
        )
      : draft.attachments.findIndex(
          (item, candidate) => candidate > index
            && item.slotId === attachment.slotId,
        )
    if (candidateIndex < 0)
      return
    const ids = draft.attachments.map(item => item.attachmentId)
    const candidateId = ids[candidateIndex]
    const attachmentIdAtIndex = ids[index]
    if (!candidateId || !attachmentIdAtIndex)
      return
    ids[candidateIndex] = attachmentIdAtIndex
    ids[index] = candidateId
    onReorder(ids)
  }

  if (attachmentSlots.length === 0)
    return null

  return (
    <section
      aria-label={t('create.attachments.title')}
      className="flex min-w-0 items-center gap-2"
    >
      <input
        accept=""
        aria-label={t('assets.uploadFiles')}
        className="sr-only"
        ref={upload.fileInputRef}
        type="file"
        onChange={(event) => {
          uploadFiles(event.currentTarget.files)
          event.currentTarget.value = ''
        }}
      />
      <div className="
        no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1
      "
      >
        {draft.attachments.map((attachment) => {
          const slot = attachmentSlots.find(item => item.id === attachment.slotId)
          const slotAttachments = draft.attachments.filter(
            item => item.slotId === attachment.slotId,
          )
          return (
            <article
              className="group relative size-14 shrink-0"
              key={attachment.attachmentId}
            >
              <button
                aria-label={t('create.attachments.open', {
                  name: attachment.asset.name,
                })}
                className="
                  flex size-14 items-center justify-center overflow-hidden
                  rounded-2xl bg-muted ring-1 ring-border/70 outline-none
                  focus-visible:ring-2 focus-visible:ring-ring
                "
                title={attachment.asset.name}
                type="button"
                onClick={() => viewer.openAsset(attachment.asset.id)}
              >
                <AssetMediaPreview
                  asset={attachment.asset}
                  className="size-full object-cover"
                />
              </button>
              {slot && attachmentSlots.length > 1 && (
                <span className="
                  pointer-events-none absolute top-1 left-1 max-w-10 truncate
                  rounded-md bg-background/85 px-1 py-0.5 text-[9px]
                  text-foreground shadow-sm
                "
                >
                  {t(slot.labelKey)}
                </span>
              )}
              <Button
                aria-label={t('create.attachments.remove', {
                  name: attachment.asset.name,
                })}
                className="absolute -top-1 -right-1 rounded-full shadow-md"
                size="icon-xs"
                title={t('create.attachments.remove', {
                  name: attachment.asset.name,
                })}
                type="button"
                variant="secondary"
                onClick={() => onRemove(attachment.attachmentId)}
              >
                <IconX stroke={2.5} />
              </Button>
              {slotAttachments.length > 1 && (
                <span className="
                  absolute right-1 bottom-1 flex rounded-full bg-background/90
                  opacity-0 ring-1 ring-border/70
                  group-focus-within:opacity-100
                  group-hover:opacity-100
                "
                >
                  <Button
                    aria-label={t('create.attachments.moveEarlier', {
                      name: attachment.asset.name,
                    })}
                    disabled={slotAttachments[0]?.attachmentId === attachment.attachmentId}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                    onClick={() => moveAttachment(attachment.attachmentId, -1)}
                  >
                    <IconArrowLeft />
                  </Button>
                  <Button
                    aria-label={t('create.attachments.moveLater', {
                      name: attachment.asset.name,
                    })}
                    disabled={slotAttachments.at(-1)?.attachmentId === attachment.attachmentId}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                    onClick={() => moveAttachment(attachment.attachmentId, 1)}
                  >
                    <IconArrowRight />
                  </Button>
                </span>
              )}
            </article>
          )
        })}
        {attachmentSlots.length > 1 || addableSlots.length > 0
          ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t('create.attachments.add')}
                  render={(
                    <Button
                      className="
                        size-14 shrink-0 flex-col gap-0 rounded-2xl
                        border-dashed px-1 text-[10px]
                      "
                      type="button"
                      variant="outline"
                    />
                  )}
                >
                  <IconPlus />
                  {t('create.attachments.add')}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  {attachmentSlots.length === 1
                    ? (
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => openUpload(attachmentSlots[0]!)}
                          >
                            <IconUpload />
                            {t('assets.upload')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setPickerSlotId(attachmentSlots[0]!.id)}
                          >
                            <IconFolderOpen />
                            {t('assets.chooseAsset')}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      )
                    : attachmentSlots.map((slot) => {
                        const slotCount = draft.attachments.filter(
                          attachment => attachment.slotId === slot.id,
                        ).length
                        const disabled = !isCreateInputSlotAddable({
                          draft,
                          resolution,
                          slotId: slot.id,
                        })
                        const reason = disabled
                          ? slotUnavailableReason(slot)
                          : undefined
                        return (
                          <DropdownMenuSub key={slot.id}>
                            <DropdownMenuSubTrigger
                              aria-label={reason
                                ? `${t(slot.labelKey)}. ${reason}`
                                : undefined}
                              disabled={disabled}
                              title={reason}
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {t(slot.labelKey)}
                              </span>
                              <span className="
                                text-xs text-muted-foreground tabular-nums
                              "
                              >
                                {slotCount}
                                /
                                {slot.maxItems}
                              </span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => openUpload(slot)}>
                                <IconUpload />
                                {t('assets.upload')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setPickerSlotId(slot.id)}
                              >
                                <IconFolderOpen />
                                {t('assets.chooseAsset')}
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )
                      })}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          : (
              <Button
                aria-label={singleSlot
                  ? t('create.attachments.atCapacity', {
                      maximum: singleSlot.maxItems,
                    })
                  : t('create.attachments.add')}
                className="
                  size-14 shrink-0 flex-col gap-0 rounded-2xl border-dashed px-1
                  text-[10px]
                  disabled:pointer-events-auto disabled:cursor-not-allowed
                "
                disabled
                title={singleSlot
                  ? slotUnavailableReason(singleSlot)
                  : undefined}
                type="button"
                variant="outline"
              >
                <IconLock />
                {t('create.attachments.add')}
              </Button>
            )}
        {singleSlot && (
          <span
            aria-label={t('create.attachments.capacity', {
              count: draft.attachments.length,
              maximum: singleSlot.maxItems,
            })}
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {draft.attachments.length}
            /
            {singleSlot.maxItems}
          </span>
        )}
      </div>
      {pickerSlot && (
        <AssetLibraryDialog
          allowedTypes={pickerAllowedTypes}
          isAssetDisabled={(asset: Asset) => {
            if (!isCreateInputSlotAddable({
              draft,
              resolution,
              slotId: pickerSlot.id,
            })) {
              return slotUnavailableReason(pickerSlot)
            }
            if (
              draft.attachments.some(item => (
                item.slotId === pickerSlot.id
                && item.asset.id === asset.id
              ))
            ) {
              return t('create.attachments.alreadyAdded')
            }
            if (asset.processingState !== 'ready')
              return t('create.attachments.notReady')
            if (
              asset.type === 'document'
              || !pickerAllowedTypes.includes(asset.type)
            ) {
              return t('create.attachments.wrongType')
            }
            if (!createAssetMatchesInputSlot(asset, pickerSlot)) {
              return t('create.attachments.wrongFormat')
            }
            return null
          }}
          open
          selectedAssetIds={draft.attachments
            .filter(item => item.slotId === pickerSlot.id)
            .map(item => item.asset.id)}
          onOpenChange={(open) => {
            if (!open)
              setPickerSlotId(null)
          }}
          onUploadBatch={(batchId) => {
            ownUploadBatchesRef.current.set(batchId, pickerSlot.id)
          }}
          onSelect={(asset) => {
            const existing = draft.attachments.filter(
              item => item.slotId === pickerSlot.id,
            )
            const reference = toCreateAssetReference(asset)
            if (!reference)
              return
            const attachment = createAttachment(reference, pickerSlot.id)
            if (!canAddCreateAttachment(draft, attachment))
              return
            onAdd(attachment)
            if (
              existing.length + 1 >= pickerSlot.maxItems
            ) {
              setPickerSlotId(null)
            }
          }}
        />
      )}
    </section>
  )
}
