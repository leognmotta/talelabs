/** Inline generation prompt editor that yields authority to a connected Text edge. */

import type { ReactNode } from 'react'

import { FlowNodeTextarea } from '../flow-node-textarea'

/** Edits an inline prompt and switches to connected-state presentation when wired. */
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
            rounded-lg border-transparent bg-muted/40 p-2.5 text-xs/relaxed
            transition-[height,background-color,border-color]
            duration-(--flow-motion-fast) ease-(--flow-motion-ease)
            hover:bg-muted/55
            focus-visible:border-(--flow-node-accent,var(--ring))
            focus-visible:bg-background/80
            motion-reduce:transition-none
          "
          collapsible
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
