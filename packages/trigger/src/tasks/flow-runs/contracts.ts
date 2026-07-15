import { FLOW_RUN_LIMITS } from '@talelabs/flows'
import { idempotencyKeys, queue } from '@trigger.dev/sdk'
import { z } from 'zod'

export const GENERATION_JOB_MAX_ATTEMPTS = 3

export const flowRunTaskPayloadSchema = z.object({
  flowRunId: z.string(),
  organizationId: z.string(),
})

export const generationJobTaskPayloadSchema = z.object({
  generationJobId: z.string(),
  organizationId: z.string(),
})

export type FlowRunTaskPayload = z.infer<typeof flowRunTaskPayloadSchema>
export type GenerationJobTaskPayload = z.infer<typeof generationJobTaskPayloadSchema>

export const flowRunQueue = queue({
  concurrencyLimit: FLOW_RUN_LIMITS.organizationRunConcurrency,
  name: 'flow-runs',
})

export const generationQueue = queue({
  concurrencyLimit: FLOW_RUN_LIMITS.organizationGenerationJobConcurrency,
  name: 'generation-jobs',
})

export function organizationConcurrencyKey(organizationId: string) {
  return organizationId
}

export async function generationJobTriggerOptions(
  organizationId: string,
  jobId: string,
) {
  return {
    concurrencyKey: organizationConcurrencyKey(organizationId),
    idempotencyKey: await idempotencyKeys.create(jobId, { scope: 'global' }),
    queue: 'generation-jobs',
  }
}
