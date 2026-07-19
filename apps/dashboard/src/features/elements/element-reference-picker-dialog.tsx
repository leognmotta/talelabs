/**
 * Multi-select reference picker for one Element: pending draft selection,
 * explicit commit, capacity affordance, and auto-selection of files uploaded
 * from inside the dialog.
 */

import type { Asset } from '@talelabs/sdk'

import { MAX_ELEMENT_REFERENCES } from '@talelabs/assets'
import { Button } from '@talelabs/ui/components/button'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AssetLibraryDialog } from '../assets/library/asset-library-dialog'
import { uploadStore } from '../uploads/upload-store'

/** Minimal reference identity carried between picker and editor drafts. */
export interface ElementReferenceDraft {
  id: string
  name: string
  thumbnailUrl: null | string
}

function toDraft(asset: Asset): ElementReferenceDraft {
  return {
    id: asset.id,
    name: asset.name,
    thumbnailUrl: asset.thumbnailUrl ?? asset.url ?? null,
  }
}

/** Owns the pending selection; nothing reaches the editor before commit. */
export function ElementReferencePickerDialog({
  initialReferences,
  onCommit,
  onOpenChange,
  open,
}: {
  initialReferences: ElementReferenceDraft[]
  onCommit: (references: ElementReferenceDraft[]) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<ElementReferenceDraft[]>([])
  const wasOpenRef = useRef(false)
  const ownBatchIdsRef = useRef(new Set<string>())

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setPending(initialReferences)
      ownBatchIdsRef.current = new Set()
    }
    wasOpenRef.current = open
  }, [open, initialReferences])

  useEffect(() => {
    if (!open)
      return
    // Files uploaded from inside the dialog join the pending selection the
    // moment their canonical Asset registers, so upload-then-attach is one
    // gesture instead of upload, find, click. Batch correlation keeps
    // uploads started elsewhere in the app from sneaking in.
    const joinedAssetIds = new Set<string>()
    return uploadStore.subscribe((state) => {
      const newlyCompleted = Object.values(state.items).filter(item =>
        item.status === 'completed'
        && item.assetId
        && item.mimeType.startsWith('image/')
        && ownBatchIdsRef.current.has(item.batchId)
        && !joinedAssetIds.has(item.assetId))
      if (newlyCompleted.length === 0)
        return
      for (const item of newlyCompleted)
        joinedAssetIds.add(item.assetId!)
      setPending((current) => {
        const next = [...current]
        for (const item of newlyCompleted) {
          if (next.length >= MAX_ELEMENT_REFERENCES)
            break
          if (next.some(reference => reference.id === item.assetId))
            continue
          next.push({
            id: item.assetId!,
            name: item.filename,
            thumbnailUrl: null,
          })
        }
        return next
      })
    })
  }, [open])

  const atCapacity = pending.length >= MAX_ELEMENT_REFERENCES

  function toggle(asset: Asset) {
    setPending((current) => {
      if (current.some(reference => reference.id === asset.id))
        return current.filter(reference => reference.id !== asset.id)
      if (current.length >= MAX_ELEMENT_REFERENCES)
        return current
      return [...current, toDraft(asset)]
    })
  }

  return (
    <AssetLibraryDialog
      allowedTypes={['image']}
      footer={(
        <>
          <span className="text-sm text-muted-foreground">
            {atCapacity
              ? t('elements.pickerAtCapacity', {
                  maximum: MAX_ELEMENT_REFERENCES,
                })
              : t('elements.pickerSelectedCount', {
                  count: pending.length,
                  maximum: MAX_ELEMENT_REFERENCES,
                })}
          </span>
          <span className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                onCommit(pending)
                onOpenChange(false)
              }}
            >
              {t('elements.pickerConfirm', { count: pending.length })}
            </Button>
          </span>
        </>
      )}
      isAssetDisabled={atCapacity
        ? asset => (pending.some(reference => reference.id === asset.id)
          ? null
          : t('elements.pickerAtCapacity', {
              maximum: MAX_ELEMENT_REFERENCES,
            }))
        : undefined}
      mode="select"
      open={open}
      selectedAssetIds={pending.map(reference => reference.id)}
      onOpenChange={onOpenChange}
      onSelect={toggle}
      onUploadBatch={batchId => ownBatchIdsRef.current.add(batchId)}
    />
  )
}
