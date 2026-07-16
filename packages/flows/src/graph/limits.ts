export const FLOW_GRAPH_LIMITS = Object.freeze({
  aggregateNodeDataBytes: 8 * 1024 * 1024,
  edges: 5_000,
  mutationsPerRequest: 500,
  nodeDataBytes: 32 * 1024,
  nodes: 2_000,
  referenceAssets: 5_000,
  referenceLinks: 10_000,
  requestBodyBytes: 2 * 1024 * 1024,
})
