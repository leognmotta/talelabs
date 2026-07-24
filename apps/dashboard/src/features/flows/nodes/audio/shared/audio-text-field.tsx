/** Inline audio prompt and lyrics editors with connected Text authority. */

import type {
  GenerationInputAvailability,
  GenerationInputSlotDefinition,
  PromptTemplate,
} from '@talelabs/flows'
import type { PromptComposerInput } from '../../../../generation/prompt-composer/prompt-composer-types'
import type { FlowInputState } from '../../../editor/flow-canvas-types'

import { FlowNodeTextarea } from '../../shared/flow-node-textarea'
import { GenerationPromptField } from '../../shared/generation-node/generation-prompt-field'
import { AudioMediaInput } from './audio-media-input'

interface AudioTextInputPresentation {
  availability: GenerationInputAvailability
  inputState: FlowInputState | null
  slot: GenerationInputSlotDefinition
}

function AudioInputHandle({ input }: { input?: AudioTextInputPresentation }) {
  return input && (
    <AudioMediaInput
      availability={input.availability}
      className="absolute top-1/2 left-0 z-20 -translate-y-1/2"
      inputState={input.inputState}
      nodeEdge={false}
      slot={input.slot}
    />
  )
}

/** Edits an inline audio text slot unless an upstream connection owns its value. */
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
  input?: AudioTextInputPresentation
  label: string
  onValueChange: (value: string) => void
  placeholder: string
  value: string
}) {
  const textareaId = `${helpId}-input`
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[11px] font-medium text-muted-foreground"
        htmlFor={textareaId}
      >
        {label}
      </label>
      <div className="relative">
        <FlowNodeTextarea
          aria-describedby={externalConnected ? helpId : undefined}
          className="
            rounded-lg border-transparent bg-muted/40 p-2.5 text-xs/relaxed
            transition-[height,background-color,border-color]
            duration-(--flow-motion-fast) ease-(--flow-motion-ease)
            hover:bg-muted/55
            focus-visible:border-(--flow-node-accent,var(--ring))
            focus-visible:bg-background/80
            motion-reduce:transition-none
          "
          collapsible
          disabled={externalConnected}
          id={textareaId}
          maxLength={16_000}
          placeholder={placeholder}
          value={value}
          onChange={event => onValueChange(event.currentTarget.value)}
        />
        <AudioInputHandle input={input} />
      </div>
      {externalConnected && (
        <span
          className="text-[10px] leading-snug text-muted-foreground"
          id={helpId}
        >
          {externalHelp}
        </span>
      )}
    </div>
  )
}

/** Edits a structured audio prompt with selected-input references. */
export function AudioPromptField({
  externalConnected,
  externalHelp,
  helpId,
  input,
  inputs,
  label,
  placeholder,
  value,
  onValueChange,
}: {
  externalConnected: boolean
  externalHelp: string
  helpId: string
  input?: AudioTextInputPresentation
  inputs: readonly PromptComposerInput[]
  label: string
  onValueChange: (value: PromptTemplate) => void
  placeholder: string
  value: PromptTemplate
}) {
  return (
    <GenerationPromptField
      externalHelp={externalHelp}
      externalPromptConnected={externalConnected}
      helpId={helpId}
      inputs={inputs}
      label={label}
      placeholder={placeholder}
      prompt={value}
      onPromptChange={onValueChange}
    >
      <AudioInputHandle input={input} />
    </GenerationPromptField>
  )
}
