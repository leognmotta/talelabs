import type { UploadStatus } from './upload.types'

import {
  IconAlertCircle,
  IconBan,
  IconCheck,
} from '@tabler/icons-react'

export function UploadStatusIcon({ status }: { status: UploadStatus }) {
  if (status === 'completed')
    return <IconCheck className="text-success" />
  if (status === 'failed')
    return <IconAlertCircle className="text-destructive" />
  if (status === 'canceled')
    return <IconBan className="text-muted-foreground" />
  return (
    <span className="relative flex size-4 items-center justify-center">
      <span className="absolute size-3 animate-ping rounded-full bg-primary/30" />
      <span className="relative size-2 rounded-full bg-primary" />
    </span>
  )
}
