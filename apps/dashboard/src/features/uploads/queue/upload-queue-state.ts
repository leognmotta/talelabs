/**
 * Owns process-local upload coordination that cannot live in Zustand because it
 * contains Files, AbortControllers, and in-flight Promises.
 */

import type { UploadCacheAdapter } from '../upload-cache'
import type { UploadRuntime } from '../upload-runtime'

import { createUploadRuntime } from '../upload-runtime'

/** Mutable coordination shared by the queue's narrowly owned operations. */
export interface UploadQueueState {
  /** Organization currently allowed to start or continue queued work. */
  activeOrganizationId: null | string
  /** Organizations blocked after a tenant switch or explicit cancellation. */
  blockedOrganizations: Set<string>
  /** Cache bridge installed by the mounted dashboard provider. */
  cache: null | UploadCacheAdapter
  /** Mount generation used to prevent stale provider cleanup. */
  configurationVersion: number
  /** Batch whose preparation or item execution currently owns the worker. */
  runningBatchId: null | string
  /** Organization associated with the current worker promise. */
  runningOrganizationId: null | string
  /** Single-flight worker promise; null means the queue may claim work. */
  runningPromise: null | Promise<void>
  /** Non-serializable files, controllers, and batch preparation state. */
  runtime: UploadRuntime
  /** Whether a microtask has already been queued to pump pending work. */
  scheduled: boolean
}

/** One process-local queue shared by every upload entry point in the dashboard. */
export const uploadQueueState: UploadQueueState = {
  activeOrganizationId: null,
  blockedOrganizations: new Set<string>(),
  cache: null,
  configurationVersion: 0,
  runningBatchId: null,
  runningOrganizationId: null,
  runningPromise: null,
  runtime: createUploadRuntime(),
  scheduled: false,
}
