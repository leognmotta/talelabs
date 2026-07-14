import type { ReactNode } from 'react'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { Textarea } from '@talelabs/ui/components/textarea'

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
    <div className="nodrag nopan flex flex-col gap-1.5">
      <label
        className="text-[11px] font-medium text-muted-foreground"
        htmlFor={textareaId}
      >
        {label}
      </label>
      <div className="relative">
        <Textarea
          aria-describedby={externalPromptConnected ? helpId : undefined}
          className="
            nowheel min-h-20 rounded-lg border-border/65 bg-background/78 p-2.5
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
