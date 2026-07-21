/** Tenant-scoped provider submission, fact, and cancellation state access. */

import type { NormalizedGenerationProviderFacts } from '@talelabs/flows'
import type { GenerationJobProviderContext } from './context.js'

import { db } from '@talelabs/db'

import {
  markProviderSubmissionStarted,
  persistProviderFacts,
  persistProviderSubmission,
} from '../state/index.js'

/** Writes the pre-network submission marker that prevents unsafe resubmission. */
export function beginGenerationProviderSubmission(
  context: GenerationJobProviderContext,
) {
  return markProviderSubmissionStarted(context)
}

/** Persists normalized cost and request identity facts for the current job. */
export function recordGenerationProviderFacts(
  context: GenerationJobProviderContext,
  facts: NormalizedGenerationProviderFacts,
) {
  return persistProviderFacts({ ...context, facts })
}

/** Persists a queue job ID before the first durable provider wait. */
export function recordGenerationProviderSubmission(
  context: GenerationJobProviderContext,
  submission: {
    externalJobId: string
    facts: NormalizedGenerationProviderFacts
  },
) {
  return persistProviderSubmission({ ...context, ...submission })
}

/** Reads the terminal run state that requests remote provider cancellation. */
export async function isGenerationProviderCancellationRequested(
  context: GenerationJobProviderContext,
) {
  const run = await db.selectFrom('generationJobs as job')
    .innerJoin('flowRuns as run', join => join
      .onRef('run.id', '=', 'job.flowRunId')
      .onRef('run.organizationId', '=', 'job.organizationId'))
    .select('run.status')
    .where('job.organizationId', '=', context.organizationId)
    .where('job.id', '=', context.jobId)
    .executeTakeFirst()
  return run?.status === 'canceled'
}
