/** Candidate and connection feedback for one audio-node media slot. */

import type { GenerationMediaInputProps } from '../../shared/generation-node/generation-media-input'
import { GenerationMediaInput } from '../../shared/generation-node/generation-media-input'

/** Renders one typed audio/media slot with connection and item-count feedback. */
export function AudioMediaInput({
  availability,
  className,
  inputState,
  nodeEdge = true,
  slot,
}: Omit<GenerationMediaInputProps, 'connectionBadge' | 'namespace' | 'status'>) {
  return (
    <GenerationMediaInput
      availability={availability}
      className={className}
      connectionBadge="hidden"
      inputState={inputState}
      namespace="audio"
      nodeEdge={nodeEdge}
      slot={slot}
      status={{
        kind: 'items',
        messageKey: 'flows.audio.inputs.selectedCount',
      }}
    />
  )
}
