import { useDeferredValue, useState } from 'react'

export function useContextListSearch() {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search.trim()) || undefined

  return { deferredSearch, search, setSearch }
}
