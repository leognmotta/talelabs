import { schemaTask } from '@trigger.dev/sdk'

import { handleFlowRunOrchestratorFailure } from '../../flow-runs/orchestration/failure.js'
import { runFlowRunOrchestrator } from '../../flow-runs/orchestration/run.js'
import {
  flowRunQueue,
  flowRunTaskPayloadSchema,
} from './contracts.js'

export const flowRunOrchestratorTask = schemaTask({
  id: 'flow-run-orchestrator',
  schema: flowRunTaskPayloadSchema,
  queue: flowRunQueue,
  retry: {
    factor: 2,
    maxAttempts: 3,
    maxTimeoutInMs: 30_000,
    minTimeoutInMs: 1_000,
  },
  onFailure: async ({ ctx, error, payload }) => {
    await handleFlowRunOrchestratorFailure({ ctx, error, payload })
  },
  run: async (payload, { ctx }) => runFlowRunOrchestrator(payload, ctx),
})
