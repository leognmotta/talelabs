/** Prompt, instructions, and optional vision inputs ordered by the LLM contract. */

import type {
  GenerationInputSlotDefinition,
  LlmState,
} from '@talelabs/flows'
import type { FlowInputState } from '../../editor/flow-canvas-types'

import { GenerationInputRail } from '../shared/generation-node/generation-input-rail'
import { LlmMediaInput } from './llm-media-input'

/** Displays text, instruction, and image-context handles supported by the model. */
export function LlmInputRail({
  ariaLabel,
  inputState,
  resolution,
  slots,
}: {
  ariaLabel: string
  inputState: (slot: GenerationInputSlotDefinition) => FlowInputState | null
  resolution: LlmState
  slots: readonly GenerationInputSlotDefinition[]
}) {
  return (
    <GenerationInputRail
      ariaLabel={ariaLabel}
      data-llm-input-rail
    >
      {slots.flatMap((slot) => {
        if (slot.id === 'instructions' || slot.id === 'prompt')
          return []
        const availability = resolution.inputAvailability[slot.id]
        return !availability || availability.state === 'unsupported'
          ? []
          : [(
              <LlmMediaInput
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
