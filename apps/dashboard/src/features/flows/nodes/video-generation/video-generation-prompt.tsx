/** Inline video prompt editor whose value yields to a connected Text input. */

import type {
  GenerationInputSlotDefinition,
  PromptTemplate,
  VideoInputAvailability,
} from '@talelabs/flows'
import type { PromptComposerInput } from '../../../generation/prompt-composer/prompt-composer-types'
import type { FlowInputState } from '../../editor/flow-canvas-types'

import { useTranslation } from 'react-i18next'
import { GenerationPromptField } from '../shared/generation-node/generation-prompt-field'
import { VideoGenerationMediaInput } from './video-generation-media-input'

/** Edits inline video prompt text unless the active contract supplies it by edge. */
export function VideoGenerationPrompt({
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
    availability: VideoInputAvailability
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
      externalHelp={t('flows.video.prompt.externalAuthoritative')}
      externalPromptConnected={externalPromptConnected}
      helpId={helpId}
      inputs={inputs}
      label={t('flows.video.prompt.label')}
      placeholder={t('flows.video.prompt.placeholder')}
      prompt={prompt}
      onPromptChange={onPromptChange}
    >
      {input && (
        <VideoGenerationMediaInput
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
