/** Stable prompt-section spacing and connected-input treatment for generation nodes. */

import type { ReactNode } from 'react'

/** Provides consistent spacing and connected-state treatment for prompt controls. */
export function GenerationNodePromptSection({ children }: { children: ReactNode }) {
  return <div className="border-t border-border/70 p-3">{children}</div>
}
