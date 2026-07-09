import type { BoardPreview } from './board-data'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import { PreviewHero } from './preview-hero'
import { PreviewTile } from './preview-tile'

export function BoardCard({
  board,
}: {
  board: BoardPreview
}) {
  return (
    <Card className="min-h-52 rounded-3xl bg-muted/50 py-0 shadow-none">
      <CardHeader className="px-4 pt-4">
        <CardDescription className="text-xs font-medium tracking-normal">
          {board.eyebrow}
        </CardDescription>
        <CardTitle className="truncate text-sm">{board.title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={`
          grid h-32 grid-cols-[1.4fr_1fr] gap-3 rounded-2xl bg-linear-to-br p-3
          ${board.accent}
        `}
        >
          <PreviewHero tone={board.tone} />
          <div className="grid grid-cols-2 gap-2">
            <PreviewTile tone={board.tone} />
            <PreviewTile tone={board.tone} />
            <PreviewTile tone={board.tone} />
            <PreviewTile tone={board.tone} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
