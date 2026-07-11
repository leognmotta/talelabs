import type { UploadBatchState, UploadItemState } from './upload.types'

import { createStore } from 'zustand/vanilla'

interface UploadStoreState {
  addBatch: (batch: UploadBatchState, items: UploadItemState[]) => void
  batches: Record<string, UploadBatchState>
  batchOrder: string[]
  clear: () => void
  clearSettled: (organizationId: string) => void
  itemOrder: string[]
  items: Record<string, UploadItemState>
  patchItem: (id: string, patch: Partial<UploadItemState>) => void
  patchItems: (ids: string[], patch: Partial<UploadItemState>) => void
  removeItems: (ids: string[]) => void
}

function removeItemsFromState(state: UploadStoreState, ids: Set<string>) {
  const items = { ...state.items }
  for (const id of ids)
    delete items[id]

  const itemOrder = state.itemOrder.filter(id => !ids.has(id))
  const batches: Record<string, UploadBatchState> = {}
  const batchOrder: string[] = []
  for (const batchId of state.batchOrder) {
    const batch = state.batches[batchId]
    if (!batch)
      continue

    const itemIds = batch.itemIds.filter(id => !ids.has(id))
    if (itemIds.length === 0)
      continue

    batches[batchId] = { ...batch, itemIds }
    batchOrder.push(batchId)
  }

  return { batches, batchOrder, items, itemOrder }
}

export const uploadStore = createStore<UploadStoreState>(set => ({
  batches: {},
  batchOrder: [],
  items: {},
  itemOrder: [],
  addBatch: (batch, items) => set(state => ({
    batches: { ...state.batches, [batch.id]: batch },
    batchOrder: [...state.batchOrder, batch.id],
    items: {
      ...state.items,
      ...Object.fromEntries(items.map(item => [item.id, item])),
    },
    itemOrder: [...state.itemOrder, ...items.map(item => item.id)],
  })),
  clear: () => set({ batches: {}, batchOrder: [], items: {}, itemOrder: [] }),
  clearSettled: organizationId => set((state) => {
    const ids = new Set(state.itemOrder.filter((id) => {
      const item = state.items[id]
      return item?.organizationId === organizationId
        && (item.status === 'completed' || item.status === 'canceled')
    }))
    return removeItemsFromState(state, ids)
  }),
  patchItem: (id, patch) => set(state => state.items[id]
    ? {
        items: {
          ...state.items,
          [id]: { ...state.items[id], ...patch },
        },
      }
    : state),
  patchItems: (ids, patch) => set((state) => {
    const items = { ...state.items }
    for (const id of ids) {
      if (items[id])
        items[id] = { ...items[id], ...patch }
    }
    return { items }
  }),
  removeItems: ids => set(state => removeItemsFromState(state, new Set(ids))),
}))
