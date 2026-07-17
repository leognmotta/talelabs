/** Pointer interaction owner for a local crop draft over one source image. */

import type { FlowImageCrop } from '@talelabs/flows'
import type { PointerEvent as ReactPointerEvent } from 'react'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import type {
  CropEdge,
  CropInteraction,
} from './image-crop-pointer-interaction'
import { cn } from '@talelabs/ui/lib/utils'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getContainedMediaSize,
} from './image-crop-geometry'
import {
  beginImageCropInteraction,
  endImageCropInteraction,
  updateImageCropInteraction,
} from './image-crop-pointer-interaction'

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

/** Renders the pointer-driven crop overlay without owning persisted node state. */
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
    const interaction = beginImageCropInteraction(
      event,
      frameRef.current?.getBoundingClientRect(),
      crop,
      mode,
      edges,
    )
    if (interaction)
      interactionRef.current = interaction
  }

  function updateInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current
    if (!interaction)
      return
    onCropChange(updateImageCropInteraction(event, interaction))
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
      onPointerCancel={event => endImageCropInteraction(event, interactionRef)}
      onPointerMove={updateInteraction}
      onPointerUp={event => endImageCropInteraction(event, interactionRef)}
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
