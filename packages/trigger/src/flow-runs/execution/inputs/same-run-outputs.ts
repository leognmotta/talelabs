import { db } from '@talelabs/db'

export async function resolveSameRunText(input: {
  flowRunId: string
  itemKey: string
  nodeId: string
  organizationId: string
}) {
  const row = await db.selectFrom('generationJobs as job')
    .innerJoin('generationJobTextOutputs as output', join => join
      .onRef('output.jobId', '=', 'job.id')
      .onRef('output.organizationId', '=', 'job.organizationId'))
    .select(['job.id as generationJobId', 'output.outputIndex', 'output.text'])
    .where('job.organizationId', '=', input.organizationId)
    .where('job.flowRunId', '=', input.flowRunId)
    .where('job.nodeId', '=', input.nodeId)
    .where('job.itemKey', '=', input.itemKey)
    .where('job.status', '=', 'succeeded')
    .orderBy('job.requestIndex')
    .orderBy('output.outputIndex')
    .executeTakeFirst()

  if (!row)
    throw new Error(`same_run_text_output_missing:${input.nodeId}:${input.itemKey}`)
  return row
}

export async function resolveSameRunAsset(input: {
  flowRunId: string
  itemKey: string
  nodeId: string
  organizationId: string
  outputIndex: number
}) {
  const row = await db.selectFrom('generationJobs as job')
    .innerJoin('assets as asset', join => join
      .onRef('asset.generationJobId', '=', 'job.id')
      .onRef('asset.organizationId', '=', 'job.organizationId'))
    .select([
      'asset.id as assetId',
      'asset.outputIndex',
      'asset.type as mediaType',
      'job.id as generationJobId',
    ])
    .where('job.organizationId', '=', input.organizationId)
    .where('job.flowRunId', '=', input.flowRunId)
    .where('job.nodeId', '=', input.nodeId)
    .where('job.itemKey', '=', input.itemKey)
    .where('job.status', '=', 'succeeded')
    .where('asset.outputIndex', '=', input.outputIndex)
    .where('asset.processingState', '=', 'ready')
    .where('asset.deletedAt', 'is', null)
    .where('asset.purgeRequestedAt', 'is', null)
    .where('asset.purgedAt', 'is', null)
    .orderBy('job.requestIndex')
    .executeTakeFirst()

  if (!row) {
    throw new Error(
      `same_run_asset_output_missing:${input.nodeId}:${input.itemKey}:${input.outputIndex}`,
    )
  }
  return row
}
