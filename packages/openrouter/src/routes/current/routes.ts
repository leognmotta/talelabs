import type { GenerationModelContractVersion } from '@talelabs/flows'

import type { CurrentVideoProviderTags } from './video.js'
import { currentChatRoutes } from './chat.js'
import { currentImageRoutes } from './image.js'
import { currentSpeechRoutes } from './speech.js'
import { currentVideoRoutes } from './video.js'

export function currentRoutes(input: {
  modelContractVersion: GenerationModelContractVersion
  providerTags: CurrentVideoProviderTags
  recraftMaxReferences: 0 | 1
  routeVersion: string
  streamVideoDelivery?: boolean
  videoRouteVersion?: string
}) {
  return [
    ...currentImageRoutes(input),
    ...currentChatRoutes(input),
    ...currentVideoRoutes({
      ...input,
      routeVersion: input.videoRouteVersion ?? input.routeVersion,
      streamDelivery: input.streamVideoDelivery,
    }),
    ...currentSpeechRoutes(input),
  ]
}
