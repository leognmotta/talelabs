import type {
  FlowRuntimeValue,
  PriorNodeOutputDescriptor,
} from '@talelabs/flows'

import { db } from '@talelabs/db'
import { createRuntimeItem } from '@talelabs/flows'

export async function localUserIdOrNull(userId: string) {
  const user = await db.selectFrom('user')
    .select('id')
    .where('id', '=', userId)
    .executeTakeFirst()
  return user?.id ?? null
}

export async function listPriorOutputs(
  organizationId: string,
  flowId: string,
): Promise<PriorNodeOutputDescriptor[]> {
  const rows = await db.selectFrom('generationJobs as job')
    .leftJoin('generationJobTextOutputs as text', join => join
      .onRef('text.jobId', '=', 'job.id')
      .onRef('text.organizationId', '=', 'job.organizationId'))
    .leftJoin('assets as asset', join => join
      .onRef('asset.generationJobId', '=', 'job.id')
      .onRef('asset.organizationId', '=', 'job.organizationId'))
    .select([
      'job.id as generationJobId',
      'job.nodeId',
      'job.itemKey',
      'job.mediaType',
      'job.completedAt',
      'asset.id as assetId',
      'asset.outputIndex as outputIndex',
      'asset.type as assetType',
      'text.text as textOutput',
    ])
    .where('job.organizationId', '=', organizationId)
    .where('job.flowId', '=', flowId)
    .where('job.status', '=', 'succeeded')
    .orderBy('job.completedAt', 'desc')
    .orderBy('job.id', 'desc')
    .execute()

  const grouped = new Map<string, typeof rows>()
  for (const row of rows) {
    grouped.set(row.generationJobId, [
      ...(grouped.get(row.generationJobId) ?? []),
      row,
    ])
  }

  return [...grouped.values()].map((jobRows) => {
    const first = jobRows[0]!
    const mediaType = first.mediaType
    const value: FlowRuntimeValue = mediaType === 'text'
      ? {
          kind: 'text',
          origin: {
            generationJobId: first.generationJobId,
            outputIndex: 0,
            source: 'priorOutput',
          },
          text: first.textOutput ?? '',
        }
      : {
          assets: jobRows
            .filter(row => row.assetId)
            .map(row => ({
              assetId: row.assetId!,
              generationJobId: first.generationJobId,
              mediaType: row.assetType as 'audio' | 'image' | 'video',
              outputIndex: row.outputIndex ?? 0,
              source: 'priorOutput' as const,
            })),
          kind: mediaType === 'image'
            ? 'imageSet'
            : mediaType === 'video' ? 'videoSet' : 'audioSet',
        }
    return {
      completedAt: first.completedAt?.toISOString() ?? new Date(0).toISOString(),
      generationJobId: first.generationJobId,
      items: [createRuntimeItem({
        key: first.itemKey,
        nodeId: first.nodeId,
        value,
      })],
      nodeId: first.nodeId,
      outputHandleId: mediaType === 'text' ? 'text' : `${mediaType}s`,
      pinned: false,
    }
  })
}
