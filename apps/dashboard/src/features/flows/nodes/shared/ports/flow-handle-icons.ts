/** Stable icon projection for semantic Flow handles. */

import type { IconSparkles } from '@tabler/icons-react'
import type { FlowValueType } from '@talelabs/flows'

import {
  IconFile,
  IconHeadphones,
  IconPhoto,
  IconTextCaption,
  IconVideo,
} from '@tabler/icons-react'
import { FirstFrameIcon, LastFrameIcon } from './frame-boundary-icons'

/** Handle-id overrides for semantic slots that need more specific icons. */
export const HANDLE_ICONS_BY_ID = {
  audio: IconHeadphones,
  audioReferences: IconHeadphones,
  firstFrame: FirstFrameIcon,
  imageReferences: IconPhoto,
  images: IconPhoto,
  lastFrame: LastFrameIcon,
  videoReferences: IconVideo,
  videos: IconVideo,
} as const

/** Default icon for each graph runtime value type. */
export const HANDLE_ICONS_BY_VALUE_TYPE = {
  Asset: IconFile,
  AudioSet: IconHeadphones,
  ImageSet: IconPhoto,
  Text: IconTextCaption,
  VideoSet: IconVideo,
} as const satisfies Record<FlowValueType, typeof IconSparkles>
