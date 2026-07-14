import type {
  AudioNodeState,
  GenerationInputSlotDefinition,
} from '@talelabs/flows'
import type { FlowInputState } from '../../../flow-canvas-types'

import { GenerationInputRail } from '../../generation-input-rail'
import { AudioMediaInput } from './audio-media-input'

export function AudioInputRail({
  ariaLabel,
  inputState,
  resolution,
  slots,
}: {
  ariaLabel: string
  inputState: (slot: GenerationInputSlotDefinition) => FlowInputState | null
  resolution: AudioNodeState
  slots: readonly GenerationInputSlotDefinition[]
}) {
  return (
    <GenerationInputRail ariaLabel={ariaLabel} data-audio-input-rail>
      {slots.flatMap((slot) => {
        if (slot.id === 'prompt' || slot.id === 'lyrics')
          return []
        const availability = resolution.inputAvailability[slot.id]
        return !availability || availability.state === 'unsupported'
          ? []
          : [
              <AudioMediaInput
                availability={availability}
                inputState={inputState(slot)}
                key={slot.id}
                slot={slot}
              />,
            ]
      })}
    </GenerationInputRail>
  )
}
