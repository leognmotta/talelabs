import { z } from '@hono/zod-openapi'
import { FLOW_GRAPH_LIMITS, FLOW_NODE_TYPES } from '@talelabs/flows'

import {
  AssetLifecycleSchema,
  AssetProcessingStateSchema,
  AssetSourceSchema,
  AssetTypeSchema,
  createListResponseSchema,
  Cuid2Schema,
  CursorSchema,
  NullableCuid2Schema,
  PaginationLimitSchema,
  TimestampSchema,
  UserIdSchema,
} from '../../schemas/common.js'

export const FlowViewportSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  zoom: z.number().finite().min(0.05).max(8),
}).openapi('FlowViewport')

export const FlowSchema = z.object({
  id: Cuid2Schema,
  name: z.string(),
  revision: z.number().int().nonnegative(),
  viewport: FlowViewportSchema,
  createdBy: UserIdSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).openapi('Flow')

export const FlowListResponseSchema = createListResponseSchema(FlowSchema)
  .openapi('FlowListResponse')

export const FlowListQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: PaginationLimitSchema,
  search: z.string().trim().min(1).max(100).optional(),
})

export const FlowParamsSchema = z.object({ id: Cuid2Schema })

export const CreateFlowRequestSchema = z.object({
  name: z.string().trim().min(1).max(255),
}).openapi('CreateFlowRequest')

export const UpdateFlowRequestSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  viewport: FlowViewportSchema.optional(),
}).refine(value => Object.keys(value).length > 0, {
  message: 'At least one field is required',
}).openapi('UpdateFlowRequest')

const NodeDataSchema = z.record(z.string(), z.any())

export const FlowNodeSchema = z.object({
  id: Cuid2Schema,
  type: z.enum(FLOW_NODE_TYPES),
  positionX: z.number().finite(),
  positionY: z.number().finite(),
  assetId: NullableCuid2Schema,
  data: NodeDataSchema,
  schemaVersion: z.number().int().positive(),
}).openapi('FlowNode')

export const FlowEdgeSchema = z.object({
  createdAt: TimestampSchema,
  id: Cuid2Schema,
  sourceNodeId: Cuid2Schema,
  targetNodeId: Cuid2Schema,
  sourceHandle: z.string().min(1).max(128).nullable(),
  targetHandle: z.string().min(1).max(128).nullable(),
}).openapi('FlowEdge')

const FlowRunNodeStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'skipped',
  'canceled',
])

const GenerationJobStatusSchema = z.enum([
  'pending',
  'running',
  'succeeded',
  'failed',
  'canceled',
])

export const FlowReferenceAssetSchema = z.object({
  id: Cuid2Schema,
  name: z.string(),
  type: AssetTypeSchema,
  source: AssetSourceSchema,
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  lifecycle: AssetLifecycleSchema,
  processingState: AssetProcessingStateSchema,
  processingError: z.string().nullable(),
  url: z.url().nullable(),
  thumbnailUrl: z.url().nullable(),
  createdAt: TimestampSchema,
  generationModel: z.string().nullable(),
}).openapi('FlowReferenceAsset')

export const FlowGraphReferencesSchema = z.object({
  assets: z.array(FlowReferenceAssetSchema).max(FLOW_GRAPH_LIMITS.referenceAssets),
}).openapi('FlowGraphReferences')

export const FlowGraphResponseSchema = z.object({
  revision: z.number().int().nonnegative(),
  nodes: z.array(FlowNodeSchema),
  edges: z.array(FlowEdgeSchema),
  activeRuns: z.array(z.object({
    runId: Cuid2Schema,
    nodeId: Cuid2Schema,
    nodeStatus: FlowRunNodeStatusSchema,
    jobStatus: GenerationJobStatusSchema.nullable(),
  })),
}).openapi('FlowGraphResponse')

function hasDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length
}

export const FlowGraphSyncRequestSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  upsertNodes: z.array(FlowNodeSchema)
    .max(FLOW_GRAPH_LIMITS.mutationsPerRequest)
    .optional(),
  deleteNodeIds: z.array(Cuid2Schema)
    .max(FLOW_GRAPH_LIMITS.mutationsPerRequest)
    .optional(),
  upsertEdges: z.array(FlowEdgeSchema)
    .max(FLOW_GRAPH_LIMITS.mutationsPerRequest)
    .optional(),
  deleteEdgeIds: z.array(Cuid2Schema)
    .max(FLOW_GRAPH_LIMITS.mutationsPerRequest)
    .optional(),
}).superRefine((value, context) => {
  const upsertNodeIds = value.upsertNodes?.map(node => node.id) ?? []
  const deleteNodeIds = value.deleteNodeIds ?? []
  const upsertEdgeIds = value.upsertEdges?.map(edge => edge.id) ?? []
  const deleteEdgeIds = value.deleteEdgeIds ?? []
  const count = upsertNodeIds.length + deleteNodeIds.length
    + upsertEdgeIds.length + deleteEdgeIds.length

  if (count === 0) {
    context.addIssue({ code: 'custom', message: 'At least one mutation is required' })
  }
  if (count > FLOW_GRAPH_LIMITS.mutationsPerRequest) {
    context.addIssue({
      code: 'custom',
      message: `At most ${FLOW_GRAPH_LIMITS.mutationsPerRequest} mutations are allowed`,
    })
  }
  if (hasDuplicates(upsertNodeIds) || hasDuplicates(deleteNodeIds)) {
    context.addIssue({ code: 'custom', message: 'Node mutation ids must be unique', path: ['upsertNodes'] })
  }
  if (hasDuplicates(upsertEdgeIds) || hasDuplicates(deleteEdgeIds)) {
    context.addIssue({ code: 'custom', message: 'Edge mutation ids must be unique', path: ['upsertEdges'] })
  }
  if (upsertNodeIds.some(id => deleteNodeIds.includes(id))) {
    context.addIssue({ code: 'custom', message: 'A node cannot be upserted and deleted together', path: ['deleteNodeIds'] })
  }
  if (upsertEdgeIds.some(id => deleteEdgeIds.includes(id))) {
    context.addIssue({ code: 'custom', message: 'An edge cannot be upserted and deleted together', path: ['deleteEdgeIds'] })
  }
}).openapi('FlowGraphSyncRequest')

export const FlowGraphSyncResponseSchema = z.object({
  revision: z.number().int().nonnegative(),
}).openapi('FlowGraphSyncResponse')
