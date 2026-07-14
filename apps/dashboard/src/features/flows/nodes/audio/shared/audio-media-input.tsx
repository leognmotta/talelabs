import type { GenerationMediaInputProps } from '../../generation-media-input'
import { GenerationMediaInput } from '../../generation-media-input'

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
