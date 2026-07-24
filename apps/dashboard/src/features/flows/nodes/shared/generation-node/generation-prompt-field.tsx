/** Structured generation prompt editor that yields to a connected Text edge. */

import type { PromptTemplate } from '@talelabs/flows'
import type { ReactNode } from 'react'
import type { PromptComposerInput } from '../../../../generation/prompt-composer/prompt-composer-types'

import { FlowPromptComposer } from './flow-prompt-composer'

/** Edits an inline prompt and switches to connected-state presentation when wired. */
export function GenerationPromptField({
  children,
  externalHelp,
  externalPromptConnected,
  helpId,
  inputs,
  label,
  placeholder,
  prompt,
  onPromptChange,
}: {
  children?: ReactNode
  externalHelp: string
  externalPromptConnected: boolean
  helpId: string
  inputs: readonly PromptComposerInput[]
  label: string
  placeholder: string
  prompt: PromptTemplate
  onPromptChange: (prompt: PromptTemplate) => void
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
        <FlowPromptComposer
          ariaDescribedBy={externalPromptConnected ? helpId : undefined}
          disabled={externalPromptConnected}
          id={textareaId}
          inputs={inputs}
          label={label}
          placeholder={placeholder}
          template={prompt}
          onChange={onPromptChange}
        />
        {children}
      </div>
      {externalPromptConnected && (
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
