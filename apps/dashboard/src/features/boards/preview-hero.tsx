import type { PreviewTone } from './board-data'

import { getPreviewGradient, getPreviewSurface } from './board-data'

export function PreviewHero({
  tone,
}: {
  tone: PreviewTone
}) {
  return (
    <div className={`
      overflow-hidden rounded-xl
      ${getPreviewSurface(tone)}
    `}
    >
      <div className={`
        size-full rounded-xl bg-linear-to-br
        ${getPreviewGradient(tone)}
      `}
      />
    </div>
  )
}
