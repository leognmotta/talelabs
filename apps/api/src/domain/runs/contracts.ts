import type { FlowRunCommand } from '@talelabs/flows'

export type RunMode = 'all' | 'downstream' | 'node' | 'selection' | 'upstream'

export type CommandRequest
  = | { expectedFlowRevision: number, mode: 'all' }
    | {
      expectedFlowRevision: number
      mode: 'downstream' | 'node' | 'upstream'
      targetNodeId: string
    }
    | {
      expectedFlowRevision: number
      mode: 'selection'
      selectedNodeIds: string[]
    }

export function toFlowRunCommand(command: CommandRequest): FlowRunCommand {
  if (command.mode === 'all')
    return { mode: 'all' }
  if (command.mode === 'selection')
    return { mode: 'selection', selectedNodeIds: command.selectedNodeIds }
  return { mode: command.mode, targetNodeId: command.targetNodeId }
}

export function commandFromAdmissionBody(input: {
  expectedFlowRevision: number
  mode: RunMode
  selectedNodeIds?: string[]
  targetNodeId?: string
}): CommandRequest {
  if (input.mode === 'all') {
    return {
      expectedFlowRevision: input.expectedFlowRevision,
      mode: 'all',
    }
  }
  if (input.mode === 'selection') {
    return {
      expectedFlowRevision: input.expectedFlowRevision,
      mode: 'selection',
      selectedNodeIds: input.selectedNodeIds ?? [],
    }
  }
  return {
    expectedFlowRevision: input.expectedFlowRevision,
    mode: input.mode,
    targetNodeId: input.targetNodeId ?? '',
  }
}
