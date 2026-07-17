/** Read-only rendering of one normalized crop within a fixed-aspect image frame. */

import type { FlowImageCrop } from '@talelabs/flows'

import {
  getContainedMediaSize,
  imageCropAspectRatio,
} from './image-crop-geometry'

/** Renders a crop by positioning the full source image behind an overflow frame. */
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
