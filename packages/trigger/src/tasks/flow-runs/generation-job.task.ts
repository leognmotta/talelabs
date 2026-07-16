import { schemaTask } from '@trigger.dev/sdk'

import { handleGenerationJobError } from '../../flow-runs/execution/job/error-handler.js'
import { runGenerationJob } from '../../flow-runs/execution/job/run.js'
import {
  GENERATION_JOB_MAX_ATTEMPTS,
  generationJobTaskPayloadSchema,
  generationQueue,
} from './contracts.js'

export const generationJobTask = schemaTask({
  id: 'generation-job',
  schema: generationJobTaskPayloadSchema,
  queue: generationQueue,
  retry: {
    factor: 2,
    maxAttempts: GENERATION_JOB_MAX_ATTEMPTS,
    maxTimeoutInMs: 30_000,
    minTimeoutInMs: 1_000,
  },
  catchError: handleGenerationJobError,
  run: runGenerationJob,
})
