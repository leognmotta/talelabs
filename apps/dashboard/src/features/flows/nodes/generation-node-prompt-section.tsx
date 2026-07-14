import type { ReactNode } from 'react'

export function GenerationNodePromptSection({ children }: { children: ReactNode }) {
  return <div className="border-t border-border/70 p-3">{children}</div>
}
