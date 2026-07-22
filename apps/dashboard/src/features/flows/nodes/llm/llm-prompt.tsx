/** Inline LLM prompt/instructions editor with connected-input authority. */

import type {
  GenerationInputAvailability,
  GenerationInputSlotDefinition,
  PromptTemplate,
} from '@talelabs/flows'
import type { FlowInputState } from '../../editor/flow-canvas-types'
import type { PromptComposerInput } from '../shared/prompt-composer/prompt-composer-types'

import { useTranslation } from 'react-i18next'
import { GenerationPromptField } from '../shared/generation-node/generation-prompt-field'
import { LlmMediaInput } from './llm-media-input'

/** Edits prompt and instruction values while respecting connected input ownership. */
export function LlmPrompt({
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
      externalHelp={t('flows.llm.prompt.externalAuthoritative')}
      externalPromptConnected={externalPromptConnected}
      helpId={helpId}
      inputs={inputs}
      label={t('flows.llm.prompt.label')}
      placeholder={t('flows.llm.prompt.placeholder')}
      prompt={prompt}
      onPromptChange={onPromptChange}
    >
      {input && (
        <LlmMediaInput
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
