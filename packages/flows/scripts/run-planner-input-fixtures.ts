import type {
  FlowRunPlannerInput,
  PriorNodeOutputDescriptor,
} from '../src/index.js'

import { createRuntimeItem } from '../src/index.js'

export function plannerInput(
  input: Omit<FlowRunPlannerInput, 'context'>,
): FlowRunPlannerInput {
  return { ...input, context: { assetTypesById: {} } }
}

export function priorTextOutput(
  nodeId: string,
  itemInputs: readonly {
    dimensions?: Readonly<Record<string, string>>
    key: string
    outputIndex: number
    text: string
  }[] = [{ key: 'prior-text-0', outputIndex: 0, text: 'prior text' }],
): PriorNodeOutputDescriptor {
  const generationJobId = `job-${nodeId}`
  return {
    completedAt: '2026-07-14T12:00:00.000Z',
    generationJobId,
    items: itemInputs.map(item => createRuntimeItem({
      dimensions: item.dimensions,
      key: item.key,
      nodeId,
      value: {
        kind: 'text',
        origin: {
          generationJobId,
          outputIndex: item.outputIndex,
          source: 'priorOutput',
        },
        text: item.text,
      },
    })),
    nodeId,
    outputHandleId: 'text',
  }
}
