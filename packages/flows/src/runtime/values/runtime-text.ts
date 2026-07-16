import type { RuntimeTextValue } from './runtime-values.js'

import { hashFlowRunItem } from '../serialization/execution-hashes.js'
import { createRuntimeItem } from './runtime-items.js'

export function createStaticTextItem(input: { nodeId: string, text: string }) {
  return createRuntimeItem<RuntimeTextValue>({
    key: `text_${hashFlowRunItem({ nodeId: input.nodeId, text: input.text })}`,
    nodeId: input.nodeId,
    value: {
      kind: 'text',
      origin: { nodeId: input.nodeId, source: 'staticText' },
      text: input.text,
    },
  })
}
