import type {
  GenerationInputSlotDefinition,
  ImageGenerationState,
} from '@talelabs/flows'
import type { FlowInputState } from '../../flow-canvas-types'

import { normalizeImageGenerationInputSlotId } from '@talelabs/flows'
import { GenerationInputRail } from '../generation-input-rail'
import { ImageGenerationMediaInput } from './image-generation-media-input'

export function ImageGenerationInputRail({
  ariaLabel,
  inputState,
  resolution,
  slots,
}: {
  ariaLabel: string
  inputState: (slot: GenerationInputSlotDefinition) => FlowInputState | null
  resolution: ImageGenerationState
  slots: readonly GenerationInputSlotDefinition[]
}) {
  return (
    <GenerationInputRail
      ariaLabel={ariaLabel}
      data-image-input-rail
    >
      {slots.flatMap((slot) => {
        if (slot.id === 'prompt')
          return []
        const availability
          = resolution.inputAvailability[
            normalizeImageGenerationInputSlotId(slot.id)
          ]
        return !availability || availability.state === 'unsupported'
          ? []
          : [
              <ImageGenerationMediaInput
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
