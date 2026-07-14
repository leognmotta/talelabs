import type { GenerationMediaInputProps } from '../generation-media-input'
import { GenerationMediaInput } from '../generation-media-input'

export function VideoGenerationMediaInput({
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
      namespace="video"
      nodeEdge={nodeEdge}
      slot={slot}
      status={{
        kind: 'connections',
        messageKey: 'flows.video.inputs.connectedCount',
      }}
    />
  )
}
