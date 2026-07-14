import type {
  GenerationInputAvailability,
  GenerationInputSlotDefinition,
} from '@talelabs/flows'
import type { FlowInputState } from '../../../flow-canvas-types'

import { GenerationPromptField } from '../../generation-prompt-field'
import { AudioMediaInput } from './audio-media-input'

export function AudioTextField({
  externalConnected,
  externalHelp,
  helpId,
  input,
  label,
  placeholder,
  value,
  onValueChange,
}: {
  externalConnected: boolean
  externalHelp: string
  helpId: string
  input?: {
    availability: GenerationInputAvailability
    inputState: FlowInputState | null
    slot: GenerationInputSlotDefinition
  }
  label: string
  onValueChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <GenerationPromptField
      externalHelp={externalHelp}
      externalPromptConnected={externalConnected}
      helpId={helpId}
      label={label}
      placeholder={placeholder}
      prompt={value}
      onPromptChange={onValueChange}
    >
      {input && (
        <AudioMediaInput
          availability={input.availability}
          className="absolute top-1/2 left-0 z-20 -translate-y-1/2"
          inputState={input.inputState}
          nodeEdge={false}
          slot={input.slot}
        />
      )}
    </GenerationPromptField>
  )
}
