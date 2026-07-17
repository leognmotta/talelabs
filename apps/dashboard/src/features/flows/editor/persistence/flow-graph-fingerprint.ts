/** Exact persisted-node and persisted-edge fingerprints used by autosave diffs. */

import type { FlowEdge, FlowNode } from '@talelabs/sdk'

/** Serializes every persisted node field so any server-relevant change is detected. */
export function nodeFingerprint(node: FlowNode) {
  return JSON.stringify(node)
}

/** Serializes every persisted edge field so any server-relevant change is detected. */
export function edgeFingerprint(edge: FlowEdge) {
  return JSON.stringify(edge)
}
