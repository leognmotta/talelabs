/** Browser persistence for the user's Create history presentation preference. */

/** Supported presentations over the same durable Create run history. */
export type CreateHistoryView = 'grid' | 'timeline'

const createHistoryViewStorageKey = 'talelabs_create_history_view'

function isCreateHistoryView(value: null | string): value is CreateHistoryView {
  return value === 'grid' || value === 'timeline'
}

/** Reads the saved history preference, falling back safely when storage is unavailable. */
export function getCreateHistoryViewPreference(): CreateHistoryView {
  if (typeof window === 'undefined')
    return 'timeline'

  try {
    const storedView = window.localStorage.getItem(createHistoryViewStorageKey)
    return isCreateHistoryView(storedView) ? storedView : 'timeline'
  }
  catch {
    return 'timeline'
  }
}

/** Persists the explicit history preference when browser storage is available. */
export function storeCreateHistoryViewPreference(view: CreateHistoryView) {
  if (typeof window === 'undefined')
    return

  try {
    window.localStorage.setItem(createHistoryViewStorageKey, view)
  }
  catch {
    // The preference is optional; history remains usable with the current view.
  }
}
