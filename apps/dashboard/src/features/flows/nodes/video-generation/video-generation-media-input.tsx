/** Candidate and connection feedback for one video-generation media slot. */

import type { GenerationMediaInputProps } from '../shared/generation-node/generation-media-input'
import { GenerationMediaInput } from '../shared/generation-node/generation-media-input'

/** Displays one model-adaptive media slot and its selected upstream inputs. */
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
