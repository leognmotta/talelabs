/** Shared folder thumbnail used by grid, list, and drag preview surfaces. */

import { IconFolder, IconFolderFilled } from '@tabler/icons-react'
import { cn } from '@talelabs/ui/lib/utils'

/** Presents folder identity without owning navigation or move behavior. */
export function FolderPreview({
  className,
  itemCount,
  thumbnailUrls,
}: {
  className?: string
  itemCount: number
  thumbnailUrls: string[]
}) {
  const urls = thumbnailUrls.slice(0, 4)

  if (urls.length === 0) {
    const FolderIcon = itemCount > 0 ? IconFolderFilled : IconFolder

    return (
      <span className={cn(
        'flex size-full items-center justify-center bg-muted/50',
        itemCount > 0 && 'bg-muted',
        className,
      )}
      >
        <FolderIcon aria-hidden className="size-14 text-muted-foreground" />
      </span>
    )
  }

  return (
    <span className={cn(
      'grid size-full gap-1.5 bg-muted p-2',
      urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
      urls.length >= 3 && 'grid-rows-2',
      className,
    )}
    >
      {urls.map((url, index) => (
        <img
          alt=""
          className={cn(
            'size-full min-h-0 min-w-0 rounded-md object-cover',
            urls.length === 3 && index === 0 && 'row-span-2',
          )}
          draggable={false}
          key={url}
          loading="lazy"
          src={url}
        />
      ))}
    </span>
  )
}
