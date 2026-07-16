import type { FlowGraphIssue } from './types.js'

export function flowNodeDataByteLength(data: unknown) {
  return new TextEncoder().encode(JSON.stringify(data)).byteLength
}

export function addFlowGraphIssue(
  issues: FlowGraphIssue[],
  code: string,
  field: string,
  params?: FlowGraphIssue['params'],
) {
  issues.push({ code, field, params })
}
