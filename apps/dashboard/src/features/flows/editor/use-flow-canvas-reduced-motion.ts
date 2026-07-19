/** Shared reduced-motion preference for Flow canvas geometry animations. */

import { useEffect, useState } from 'react'

/** Tracks whether the operating system requests reduced visual motion. */
export function useFlowCanvasReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches)
    }
    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  return reducedMotion
}
