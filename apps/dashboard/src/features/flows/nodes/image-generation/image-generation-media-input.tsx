/** Candidate and connection feedback for one image-generation media slot. */

import type { GenerationMediaInputProps } from '../shared/generation-node/generation-media-input'
import { GenerationMediaInput } from '../shared/generation-node/generation-media-input'

/** Displays one image-reference slot and its selected upstream Assets. */
export function ImageGenerationMediaInput({
  availability,
  className,
  inputState,
  nodeEdge = true,
  slot,
}: Omit<GenerationMediaInputProps, 'namespace' | 'status'>) {
  return (
    <GenerationMediaInput
      availability={availability}
      className={className}
      inputState={inputState}
      namespace="image"
      nodeEdge={nodeEdge}
      slot={slot}
      status={{
        kind: 'items',
        messageKey: 'flows.image.inputs.selectedCount',
      }}
    />
  )
}
