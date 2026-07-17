/** Vision candidate and connection feedback for the optional LLM image slot. */

import type { GenerationMediaInputProps } from '../shared/generation-node/generation-media-input'
import { GenerationMediaInput } from '../shared/generation-node/generation-media-input'

/** Displays one LLM image-context slot and its selected upstream Assets. */
export function LlmMediaInput({
  availability,
  className,
  inputState,
  nodeEdge = true,
  slot,
}: Omit<GenerationMediaInputProps, 'namespace' | 'status'>) {
  const isImages = slot.id === 'imageReferences'
  return (
    <GenerationMediaInput
      availability={availability}
      className={className}
      inputState={inputState}
      namespace="llm"
      nodeEdge={nodeEdge}
      slot={slot}
      status={isImages
        ? {
            kind: 'items',
            messageKey: 'flows.llm.inputs.selectedImages',
          }
        : {
            kind: 'connections',
            messageKey: 'flows.llm.inputs.connectedCount',
          }}
    />
  )
}
