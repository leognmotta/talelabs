/** Semantic video inputs ordered and filtered by the selected model contract. */

import type {
  GenerationInputSlotDefinition,
  VideoGenerationState,
} from '@talelabs/flows'
import type { FlowInputState } from '../../editor/flow-canvas-types'

import { GenerationInputRail } from '../shared/generation-node/generation-input-rail'
import { VideoGenerationMediaInput } from './video-generation-media-input'

/** Displays model-adaptive video input handles and their connected values. */
export function VideoGenerationInputRail({
  ariaLabel,
  inputState,
  resolution,
  slots,
}: {
  ariaLabel: string
  inputState: (slot: GenerationInputSlotDefinition) => FlowInputState | null
  resolution: VideoGenerationState
  slots: readonly GenerationInputSlotDefinition[]
}) {
  return (
    <GenerationInputRail
      ariaLabel={ariaLabel}
      data-video-input-rail
    >
      {slots.flatMap((slot) => {
        if (slot.id === 'prompt')
          return []
        const availability = resolution.inputAvailability[slot.id]
        return !availability || availability.state === 'unsupported'
          ? []
          : [(
              <VideoGenerationMediaInput
                availability={availability}
                inputState={inputState(slot)}
                key={slot.id}
                slot={slot}
              />
            )]
      })}
    </GenerationInputRail>
  )
}
