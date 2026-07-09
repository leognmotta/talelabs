import type { PreviewTone } from './board-data'

import { getPreviewGradient, getPreviewSurface } from './board-data'

export function PreviewTile({
  tone,
}: {
  tone: PreviewTone
}) {
  return (
    <div className={`
      rounded-xl
      ${getPreviewSurface(tone)}
    `}
    >
      <div className={`
        size-full rounded-xl bg-linear-to-br opacity-80
        ${getPreviewGradient(tone)}
      `}
      />
    </div>
  )
}
