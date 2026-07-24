/** Inline image prompt editor whose value yields to a connected Text input. */

import type {
  GenerationInputAvailability,
  GenerationInputSlotDefinition,
  PromptTemplate,
} from '@talelabs/flows'
import type { PromptComposerInput } from '../../../generation/prompt-composer/prompt-composer-types'
import type { FlowInputState } from '../../editor/flow-canvas-types'

import { useTranslation } from 'react-i18next'
import { GenerationPromptField } from '../shared/generation-node/generation-prompt-field'
import { ImageGenerationMediaInput } from './image-generation-media-input'

/** Edits inline image prompt text unless an upstream text edge supplies it. */
export function ImageGenerationPrompt({
  externalPromptConnected,
  helpId,
  input,
  inputs,
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
  inputs: readonly PromptComposerInput[]
  prompt: PromptTemplate
  onPromptChange: (prompt: PromptTemplate) => void
}) {
  const { t } = useTranslation()

  return (
    <GenerationPromptField
      externalHelp={t('flows.image.prompt.externalAuthoritative')}
      externalPromptConnected={externalPromptConnected}
      helpId={helpId}
      inputs={inputs}
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
