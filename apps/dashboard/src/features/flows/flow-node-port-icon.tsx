import type { PortPreviewItem } from './flow-node-port-preview'

import {
  IconComponents,
  IconFile,
  IconHeadphones,
  IconPhoto,
  IconTextCaption,
  IconVideo,
} from '@tabler/icons-react'

export function FlowNodePortIcon({ item }: { item: PortPreviewItem }) {
  if (item.asset?.type === 'audio' || item.valueType === 'AudioSet')
    return <IconHeadphones aria-hidden className="size-4" />
  if (item.asset?.type === 'image' || item.valueType === 'ImageSet')
    return <IconPhoto aria-hidden className="size-4" />
  if (item.asset?.type === 'video' || item.valueType === 'VideoSet')
    return <IconVideo aria-hidden className="size-4" />
  if (item.valueType === 'Text')
    return <IconTextCaption aria-hidden className="size-4" />
  if (item.valueType === 'ElementContext')
    return <IconComponents aria-hidden className="size-4" />
  return <IconFile aria-hidden className="size-4" />
}
