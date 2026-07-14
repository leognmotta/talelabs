import type {
  GenerationInputAvailability,
  GenerationInputSlotDefinition,
} from '@talelabs/flows'
import type { FlowInputState } from '../../flow-canvas-types'

import { useTranslation } from 'react-i18next'
import { GenerationPromptField } from '../generation-prompt-field'
import { ImageGenerationMediaInput } from './image-generation-media-input'

export function ImageGenerationPrompt({
  externalPromptConnected,
  helpId,
  input,
  prompt,
  onPromptChange,
}: {
  externalPromptConnected: boolean
  helpId: string
  input?: {
    availability: GenerationInputAvailability
    inputState: FlowInputState | null
    slot: GenerationInputSlotDefinition
  }
  prompt: string
  onPromptChange: (prompt: string) => void
}) {
  const { t } = useTranslation()

  return (
    <GenerationPromptField
      externalHelp={t('flows.image.prompt.externalAuthoritative')}
      externalPromptConnected={externalPromptConnected}
      helpId={helpId}
      label={t('flows.image.prompt.label')}
      placeholder={t('flows.image.prompt.placeholder')}
      prompt={prompt}
      onPromptChange={onPromptChange}
    >
      {input && (
        <ImageGenerationMediaInput
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
