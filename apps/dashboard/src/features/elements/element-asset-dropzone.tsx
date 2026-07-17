/** Local File and existing-Asset staging for one dormant Element reference role. */

import type {
  ElementAssetRoleDefinition,
} from '@talelabs/elements'
import type { PendingElementAsset } from './pending-element-assets'

import {
  IconFileMusic,
  IconPhoto,
  IconPhotoPlus,
  IconPlus,
  IconTrash,
  IconVideo,
} from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { cn } from '@talelabs/ui/lib/utils'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AssetMediaPreview } from '../assets/media/asset-media-preview'

function PendingAssetPreview({ asset }: { asset: PendingElementAsset }) {
  if (asset.kind === 'existing')
    return <AssetMediaPreview asset={asset.asset} />

  if (asset.file.type.startsWith('image/')) {
    return (
      <img
        alt={asset.file.name}
        className="size-full object-cover"
        src={asset.previewUrl}
      />
    )
  }
  if (asset.file.type.startsWith('video/')) {
    return (
      <div className="relative size-full bg-black">
        <video
          aria-label={asset.file.name}
          className="size-full object-cover"
          muted
          playsInline
          preload="metadata"
          src={asset.previewUrl}
        />
        <IconVideo className="absolute right-2 bottom-2 size-5 text-white" />
      </div>
    )
  }
  return (
    <div className="
      flex size-full flex-col items-center justify-center gap-2 p-3
    "
    >
      <IconFileMusic className="size-8 text-muted-foreground" />
      <span className="line-clamp-2 text-center text-xs">
        {asset.file.name}
      </span>
    </div>
  )
}

function pendingAssetName(asset: PendingElementAsset) {
  return asset.kind === 'upload' ? asset.file.name : asset.asset.name
}

/** Keeps File previews local until Element creation transfers them to the upload queue. */
export function ElementAssetDropzone({
  assets,
  description,
  label,
  onAddExisting,
  onFiles,
  onRemove,
  onRemoveRole,
  role,
}: {
  assets: PendingElementAsset[]
  description: string
  label: string
  onAddExisting: () => void
  onFiles: (files: File[]) => void
  onRemove: (clientId: string) => void
  onRemoveRole?: () => void
  role: ElementAssetRoleDefinition
}) {
  const { t } = useTranslation()
  const generatedId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)
  const [dragActive, setDragActive] = useState(false)
  const inputId = `element-create-assets-${generatedId}`
  const accept = role.accepts.map(type => `${type}/*`).join(',')
  const atLimit = assets.length >= role.maxAssets

  function acceptFiles(files: FileList | null) {
    if (files?.length)
      onFiles(Array.from(files))
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">
            {label}
          </h3>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="outline">
            {t(`assets.types.${role.accepts[0]}`)}
          </Badge>
          <Badge
            aria-label={t('elements.assetLimits.countLabel', {
              current: assets.length,
              maximum: role.maxAssets,
            })}
            variant="secondary"
          >
            {assets.length}
            {' / '}
            {role.maxAssets}
          </Badge>
          <Button
            disabled={atLimit}
            size="sm"
            type="button"
            variant="outline"
            onClick={onAddExisting}
          >
            <IconPhotoPlus data-icon="inline-start" />
            {t('elements.addExisting')}
          </Button>
          {onRemoveRole && (
            <Button
              aria-label={t('elements.createAssets.removeRole', {
                name: label,
              })}
              size="icon-xs"
              type="button"
              variant="ghost"
              onClick={onRemoveRole}
            >
              <IconTrash />
            </Button>
          )}
        </div>
      </header>

      <input
        ref={inputRef}
        className="sr-only"
        id={inputId}
        multiple={role.multiple}
        type="file"
        accept={accept}
        onChange={(event) => {
          acceptFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <div
        className={cn(
          `
            flex min-h-40 flex-wrap gap-3 rounded-xl bg-muted/60 p-3 ring-1
            ring-border transition-colors
          `,
          dragActive && 'bg-primary/10 ring-2 ring-primary',
        )}
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepthRef.current += 1
          setDragActive(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          dragDepthRef.current -= 1
          if (dragDepthRef.current <= 0) {
            dragDepthRef.current = 0
            setDragActive(false)
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(event) => {
          event.preventDefault()
          dragDepthRef.current = 0
          setDragActive(false)
          acceptFiles(event.dataTransfer.files)
        }}
      >
        <Button
          aria-describedby={`${inputId}-description`}
          className="
            h-32 w-36 shrink-0 flex-col gap-2 border-dashed whitespace-normal
          "
          disabled={atLimit}
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          {assets.length ? <IconPlus /> : <IconPhoto />}
          <span className="text-center text-xs">
            {dragActive
              ? t('elements.createAssets.dropNow')
              : t('elements.createAssets.chooseFiles')}
          </span>
        </Button>

        {assets.map(asset => (
          <figure
            key={asset.clientId}
            className="
              group relative h-32 w-36 overflow-hidden rounded-lg bg-background
              ring-1 ring-border
            "
          >
            <PendingAssetPreview asset={asset} />
            <Button
              aria-label={t('elements.createAssets.removeFile', {
                name: pendingAssetName(asset),
              })}
              className="absolute top-2 right-2 opacity-90"
              size="icon-xs"
              type="button"
              variant="secondary"
              onClick={() => onRemove(asset.clientId)}
            >
              <IconTrash />
            </Button>
          </figure>
        ))}
        <p id={`${inputId}-description`} className="sr-only">
          {t('elements.createAssets.dropzoneDescription')}
        </p>
        <p className="sr-only" aria-live="polite">
          {t('elements.createAssets.selectedCount', { count: assets.length })}
        </p>
      </div>
    </section>
  )
}
