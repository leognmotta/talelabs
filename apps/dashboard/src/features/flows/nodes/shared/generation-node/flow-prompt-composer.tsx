/** React Flow interaction wrapper around the neutral structured prompt editor. */

import type { PromptComposerProps } from '../../../../generation/prompt-composer/prompt-composer'

import { PromptComposer } from '../../../../generation/prompt-composer/prompt-composer'

/** Adds canvas event-isolation behavior without leaking React Flow into Tiptap. */
export function FlowPromptComposer(props: PromptComposerProps) {
  return (
    <PromptComposer
      {...props}
      interactionClassName="nodrag nopan nowheel"
    />
  )
}
