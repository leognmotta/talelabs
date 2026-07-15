import type { Database, Transaction } from '@talelabs/db'

import { createId } from '@paralleldrive/cuid2'

import { chunkRunRows } from './run-persistence.data.js'

/** Clones one immutable run's relational execution rows in bounded bulk writes. */
export async function cloneRunExecutionRowsForRetry(input: {
  createdBy: null | string
  organizationId: string
  retryRunId: string
  sourceRunId: string
  trx: Transaction<Database>
}) {
  const nodes = await input.trx.selectFrom('flowRunNodes')
    .select('nodeId')
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.sourceRunId)
    .orderBy('nodeId')
    .execute()
  const items = await input.trx.selectFrom('flowRunNodeItems')
    .select(['dimensions', 'itemKey', 'lineage', 'nodeId', 'sortOrder'])
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.sourceRunId)
    .orderBy('nodeId')
    .orderBy('sortOrder')
    .orderBy('itemKey')
    .execute()
  const jobs = await input.trx.selectFrom('generationJobs')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.sourceRunId)
    .orderBy('nodeId')
    .orderBy('itemKey')
    .orderBy('requestIndex')
    .orderBy('id')
    .execute()
  const sources = await input.trx.selectFrom('generationJobSources as source')
    .innerJoin('generationJobs as job', join => join
      .onRef('job.id', '=', 'source.jobId')
      .onRef('job.organizationId', '=', 'source.organizationId'))
    .selectAll('source')
    .where('job.organizationId', '=', input.organizationId)
    .where('job.flowRunId', '=', input.sourceRunId)
    .orderBy('source.jobId')
    .orderBy('source.sortOrder')
    .orderBy('source.id')
    .execute()
  const jobInputs = await input.trx.selectFrom('generationJobInputs as input')
    .innerJoin('generationJobs as job', join => join
      .onRef('job.id', '=', 'input.jobId')
      .onRef('job.organizationId', '=', 'input.organizationId'))
    .innerJoin('assets as inputAsset', join => join
      .onRef('inputAsset.id', '=', 'input.assetId')
      .onRef('inputAsset.organizationId', '=', 'input.organizationId'))
    .leftJoin('generationJobs as producer', join => join
      .onRef('producer.id', '=', 'inputAsset.generationJobId')
      .onRef('producer.organizationId', '=', 'inputAsset.organizationId'))
    .selectAll('input')
    .select('producer.flowRunId as producerFlowRunId')
    .where('job.organizationId', '=', input.organizationId)
    .where('job.flowRunId', '=', input.sourceRunId)
    .orderBy('input.jobId')
    .orderBy('input.sortOrder')
    .orderBy('input.assetId')
    .execute()

  for (const values of chunkRunRows(nodes.map(node => ({
    flowRunId: input.retryRunId,
    nodeId: node.nodeId,
    organizationId: input.organizationId,
    status: 'pending' as const,
  })))) {
    await input.trx.insertInto('flowRunNodes').values(values).execute()
  }

  for (const values of chunkRunRows(items.map(item => ({
    dimensions: item.dimensions,
    flowRunId: input.retryRunId,
    itemKey: item.itemKey,
    lineage: item.lineage,
    nodeId: item.nodeId,
    organizationId: input.organizationId,
    sortOrder: item.sortOrder,
    status: 'pending' as const,
  })))) {
    await input.trx.insertInto('flowRunNodeItems').values(values).execute()
  }

  const jobIds = new Map<string, string>()
  const retryJobs = jobs.map((job) => {
    const jobId = createId()
    jobIds.set(job.id, jobId)
    return {
      adapterVersion: job.adapterVersion,
      createdBy: input.createdBy,
      flowId: job.flowId,
      flowRunId: input.retryRunId,
      id: jobId,
      idempotencyKey: `${input.retryRunId}:${job.nodeId}:${job.itemKey}:${job.requestIndex}`,
      itemKey: job.itemKey,
      mediaType: job.mediaType,
      model: job.model,
      modelRegistryVersion: job.modelRegistryVersion,
      nodeId: job.nodeId,
      operation: job.operation,
      organizationId: input.organizationId,
      provider: job.provider,
      providerModel: job.providerModel,
      providerRouteVersion: job.providerRouteVersion,
      requestHash: job.requestHash,
      requestIndex: job.requestIndex,
      requestPayload: job.requestPayload,
      resolvedPrompt: job.resolvedPrompt,
      settings: job.settings,
      status: 'pending' as const,
    }
  })
  for (const values of chunkRunRows(retryJobs))
    await input.trx.insertInto('generationJobs').values(values).execute()

  const sourceIds = new Map<string, string>()
  const retrySources = sources.map((source) => {
    const jobId = jobIds.get(source.jobId)
    if (!jobId)
      throw new Error('retry_clone_missing_job')
    const sourceId = createId()
    sourceIds.set(source.id, sourceId)
    return {
      assetId: source.assetId,
      elementId: source.elementId,
      id: sourceId,
      jobId,
      nodeId: source.nodeId,
      organizationId: input.organizationId,
      resolvedText: source.resolvedText,
      snapshot: source.snapshot,
      sortOrder: source.sortOrder,
      sourceType: source.sourceType,
    }
  })
  for (const values of chunkRunRows(retrySources))
    await input.trx.insertInto('generationJobSources').values(values).execute()

  const retryInputs = jobInputs
    .filter(jobInput => jobInput.producerFlowRunId !== input.sourceRunId)
    .map((jobInput) => {
      const jobId = jobIds.get(jobInput.jobId)
      if (!jobId)
        throw new Error('retry_clone_missing_job')
      return {
        assetId: jobInput.assetId,
        jobId,
        organizationId: input.organizationId,
        role: jobInput.role,
        sortOrder: jobInput.sortOrder,
        sourceId: jobInput.sourceId
          ? sourceIds.get(jobInput.sourceId) ?? null
          : null,
      }
    })
  for (const values of chunkRunRows(retryInputs))
    await input.trx.insertInto('generationJobInputs').values(values).execute()
}
