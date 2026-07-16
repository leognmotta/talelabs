import type { ReactNode } from 'react'

import { FlowNodeTextarea } from './flow-node-textarea'

export function GenerationPromptField({
  children,
  externalHelp,
  externalPromptConnected,
  helpId,
  label,
  placeholder,
  prompt,
  onPromptChange,
}: {
  children?: ReactNode
  externalHelp: string
  externalPromptConnected: boolean
  helpId: string
  label: string
  placeholder: string
  prompt: string
  onPromptChange: (prompt: string) => void
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
          aria-describedby={externalPromptConnected ? helpId : undefined}
          className="
            min-h-20 rounded-lg border-border/65 bg-background/78 p-2.5
            text-xs/relaxed
          "
          disabled={externalPromptConnected}
          id={textareaId}
          maxLength={16_000}
          placeholder={placeholder}
          value={prompt}
          onChange={event => onPromptChange(event.currentTarget.value)}
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
