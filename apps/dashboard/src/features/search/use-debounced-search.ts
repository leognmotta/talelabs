import { useEffect, useState } from 'react'

import {
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_MIN_LENGTH,
} from './search.constants'

export function useDebouncedSearch(value: string) {
  const normalizedValue = value.trim()
  const [debouncedValue, setDebouncedValue] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedValue(
        normalizedValue.length >= GLOBAL_SEARCH_MIN_LENGTH
          ? normalizedValue
          : '',
      )
    }, normalizedValue.length >= GLOBAL_SEARCH_MIN_LENGTH
      ? GLOBAL_SEARCH_DEBOUNCE_MS
      : 0)

    return () => window.clearTimeout(timeout)
  }, [normalizedValue])

  return debouncedValue
}
