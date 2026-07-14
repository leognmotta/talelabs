import type { FlowImageCrop } from '@talelabs/flows'
import type { PointerEvent as ReactPointerEvent } from 'react'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { cn } from '@talelabs/ui/lib/utils'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getContainedMediaSize,
  imageCropAspectRatio,
  roundImageCrop,
} from './image-crop'

const MINIMUM_CROP_SIZE = 0.08

type CropEdge = 'bottom' | 'left' | 'right' | 'top'

interface CropInteraction {
  edges: CropEdge[]
  frameHeight: number
  frameWidth: number
  mode: 'move' | 'resize'
  startCrop: FlowImageCrop
  startX: number
  startY: number
}

const RESIZE_HANDLES = [
  { className: 'top-px left-px size-3 cursor-nw-resize', edges: ['top', 'left'] },
  { className: 'top-px left-1/2 h-3 w-7 -translate-x-1/2 cursor-n-resize', edges: ['top'] },
  { className: 'top-px right-px size-3 cursor-ne-resize', edges: ['top', 'right'] },
  { className: 'top-1/2 right-px h-7 w-3 -translate-y-1/2 cursor-e-resize', edges: ['right'] },
  { className: 'right-px bottom-px size-3 cursor-se-resize', edges: ['bottom', 'right'] },
  { className: 'bottom-px left-1/2 h-3 w-7 -translate-x-1/2 cursor-s-resize', edges: ['bottom'] },
  { className: 'bottom-px left-px size-3 cursor-sw-resize', edges: ['bottom', 'left'] },
  { className: 'top-1/2 left-px h-7 w-3 -translate-y-1/2 cursor-w-resize', edges: ['left'] },
] as const satisfies readonly { className: string, edges: readonly CropEdge[] }[]

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function CroppedImagePreview({
  alt,
  crop,
  frameAspectRatio,
  onSourceAspectRatioChange,
  sourceHeight,
  sourceWidth,
  src,
}: {
  alt: string
  crop: FlowImageCrop
  frameAspectRatio: number
  onSourceAspectRatioChange?: (aspectRatio: number) => void
  sourceHeight: null | number
  sourceWidth: null | number
  src: string
}) {
  const contentAspectRatio = imageCropAspectRatio(
    crop,
    sourceWidth,
    sourceHeight,
  )
  return (
    <div className="flex size-full items-center justify-center bg-background">
      <div
        className="relative overflow-hidden"
        style={getContainedMediaSize(contentAspectRatio, frameAspectRatio)}
      >
        <img
          alt={alt}
          className="pointer-events-none absolute max-w-none select-none"
          draggable={false}
          height={sourceHeight ?? undefined}
          src={src}
          style={{
            left: `${-crop.x / crop.width * 100}%`,
            top: `${-crop.y / crop.height * 100}%`,
            width: `${100 / crop.width}%`,
          }}
          width={sourceWidth ?? undefined}
          onLoad={(event) => {
            const { naturalHeight, naturalWidth } = event.currentTarget
            if (naturalWidth > 0 && naturalHeight > 0)
              onSourceAspectRatioChange?.(naturalWidth / naturalHeight)
          }}
        />
      </div>
    </div>
  )
}

export function ImageCropEditor({
  alt,
  crop,
  frameAspectRatio,
  sourceHeight,
  sourceWidth,
  src,
  onCropChange,
}: {
  alt: string
  crop: FlowImageCrop
  frameAspectRatio: number
  sourceHeight: null | number
  sourceWidth: null | number
  src: string
  onCropChange: (crop: FlowImageCrop) => void
}) {
  const { t } = useTranslation()
  const frameRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<CropInteraction | null>(null)
  const sourceAspectRatio = sourceWidth && sourceHeight
    ? sourceWidth / sourceHeight
    : 1
  const sourceMediaSize = getContainedMediaSize(
    sourceAspectRatio,
    frameAspectRatio,
  )

  function beginInteraction(
    event: ReactPointerEvent<HTMLElement>,
    mode: CropInteraction['mode'],
    edges: CropEdge[] = [],
  ) {
    if (event.button !== 0)
      return
    const frame = frameRef.current?.getBoundingClientRect()
    if (!frame)
      return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionRef.current = {
      edges,
      frameHeight: frame.height,
      frameWidth: frame.width,
      mode,
      startCrop: crop,
      startX: event.clientX,
      startY: event.clientY,
    }
  }

  function updateInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current
    if (!interaction)
      return
    event.preventDefault()
    event.stopPropagation()
    const deltaX = (event.clientX - interaction.startX) / interaction.frameWidth
    const deltaY = (event.clientY - interaction.startY) / interaction.frameHeight
    const start = interaction.startCrop

    if (interaction.mode === 'move') {
      onCropChange(roundImageCrop({
        ...start,
        x: clamp(start.x + deltaX, 0, 1 - start.width),
        y: clamp(start.y + deltaY, 0, 1 - start.height),
      }))
      return
    }

    const next = { ...start }
    if (interaction.edges.includes('left')) {
      const right = start.x + start.width
      next.x = clamp(start.x + deltaX, 0, right - MINIMUM_CROP_SIZE)
      next.width = right - next.x
    }
    if (interaction.edges.includes('right')) {
      next.width = clamp(
        start.width + deltaX,
        MINIMUM_CROP_SIZE,
        1 - start.x,
      )
    }
    if (interaction.edges.includes('top')) {
      const bottom = start.y + start.height
      next.y = clamp(start.y + deltaY, 0, bottom - MINIMUM_CROP_SIZE)
      next.height = bottom - next.y
    }
    if (interaction.edges.includes('bottom')) {
      next.height = clamp(
        start.height + deltaY,
        MINIMUM_CROP_SIZE,
        1 - start.y,
      )
    }
    onCropChange(roundImageCrop(next))
  }

  function endInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactionRef.current)
      return
    event.preventDefault()
    event.stopPropagation()
    interactionRef.current = null
  }

  return (
    <div
      aria-label={t('flows.cropEditor.label')}
      className="
        nodrag nopan nowheel relative flex w-full touch-none items-center
        justify-center overflow-hidden rounded-lg border border-border/70
        bg-background select-none
      "
      role="group"
      style={{ aspectRatio: frameAspectRatio }}
      onPointerCancel={endInteraction}
      onPointerMove={updateInteraction}
      onPointerUp={endInteraction}
    >
      <div
        className="relative"
        ref={frameRef}
        style={sourceMediaSize}
      >
        <img
          alt={alt}
          className="pointer-events-none absolute inset-0 size-full"
          draggable={false}
          height={sourceHeight ?? undefined}
          src={src}
          width={sourceWidth ?? undefined}
        />

        <div
          className="
            pointer-events-none absolute inset-x-0 top-0 bg-background/75
          "
          style={{ height: `${crop.y * 100}%` }}
        />
        <div
          className="
            pointer-events-none absolute inset-x-0 bottom-0 bg-background/75
          "
          style={{ height: `${(1 - crop.y - crop.height) * 100}%` }}
        />
        <div className="pointer-events-none absolute left-0 bg-background/75" style={{ height: `${crop.height * 100}%`, top: `${crop.y * 100}%`, width: `${crop.x * 100}%` }} />
        <div className="pointer-events-none absolute right-0 bg-background/75" style={{ height: `${crop.height * 100}%`, top: `${crop.y * 100}%`, width: `${(1 - crop.x - crop.width) * 100}%` }} />

        <div
          aria-label={t('flows.cropEditor.cropArea')}
          className="
            absolute cursor-move border-2 border-foreground
            shadow-[0_0_0_1px_rgb(0_0_0/0.45)]
          "
          role="group"
          style={{
            height: `${crop.height * 100}%`,
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.width * 100}%`,
          }}
          onPointerDown={event => beginInteraction(event, 'move')}
        >
          <div className="
            pointer-events-none absolute inset-y-0 left-1/3 w-px
            bg-foreground/25
          "
          />
          <div className="
            pointer-events-none absolute inset-y-0 right-1/3 w-px
            bg-foreground/25
          "
          />
          <div className="
            pointer-events-none absolute inset-x-0 top-1/3 h-px bg-foreground/25
          "
          />
          <div className="
            pointer-events-none absolute inset-x-0 bottom-1/3 h-px
            bg-foreground/25
          "
          />
          {RESIZE_HANDLES.map(handle => (
            <button
              aria-label={t('flows.cropEditor.resizeArea')}
              className={cn(
                `
                  absolute rounded-sm border border-background bg-foreground
                  shadow-sm outline-none
                  focus-visible:ring-2 focus-visible:ring-ring
                `,
                handle.className,
              )}
              key={handle.edges.join('-')}
              type="button"
              onPointerDown={(event) => {
                beginInteraction(event, 'resize', [...handle.edges])
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
