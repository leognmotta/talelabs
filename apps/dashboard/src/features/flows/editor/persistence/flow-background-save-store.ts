/** App-lifetime tracking for Flow saves that outlive their editor route. */

import { createStore } from 'zustand/vanilla'

interface FlowBackgroundSaveState {
  pendingKeys: ReadonlySet<string>
}

const pendingSaves = new Map<string, Promise<null | number>>()

/** Tracks Flow identities whose final graph revision is saving in the background. */
export const flowBackgroundSaveStore = createStore<FlowBackgroundSaveState>()(
  () => ({ pendingKeys: new Set() }),
)

/** Builds the tenant-scoped identity shared by save dispatch and editor hydration. */
export function createFlowBackgroundSaveKey(
  organizationId: string,
  flowId: string,
): string {
  return `${organizationId}:${flowId}`
}

/** Starts one deduplicated save without tying its lifetime to the editor component. */
export function dispatchFlowBackgroundSave(input: {
  /** Tenant-scoped Flow identity returned by `createFlowBackgroundSaveKey`. */
  key: string
  /** Existing revision-aware autosave command reading from the scoped canvas store. */
  save: () => Promise<null | number>
}): Promise<null | number> {
  const pending = pendingSaves.get(input.key)
  if (pending)
    return pending

  flowBackgroundSaveStore.setState(state => ({
    pendingKeys: new Set([...state.pendingKeys, input.key]),
  }))
  const promise = input.save().finally(() => {
    pendingSaves.delete(input.key)
    flowBackgroundSaveStore.setState(state => ({
      pendingKeys: new Set(
        [...state.pendingKeys].filter(key => key !== input.key),
      ),
    }))
  })
  pendingSaves.set(input.key, promise)
  return promise
}
