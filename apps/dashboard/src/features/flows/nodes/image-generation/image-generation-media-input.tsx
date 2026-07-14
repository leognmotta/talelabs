import type { GenerationMediaInputProps } from '../generation-media-input'
import { GenerationMediaInput } from '../generation-media-input'

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
