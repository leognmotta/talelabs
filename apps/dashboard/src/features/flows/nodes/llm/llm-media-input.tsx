import type { GenerationMediaInputProps } from '../generation-media-input'
import { GenerationMediaInput } from '../generation-media-input'

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
