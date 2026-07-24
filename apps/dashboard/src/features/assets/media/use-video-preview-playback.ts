/** Leaf playback state for Asset video previews and their media element refs. */

import type { FocusEvent, RefCallback } from 'react'

import { useCallback, useRef, useState } from 'react'

function resetVideo(video: HTMLVideoElement) {
  video.pause()
  if (video.readyState > 0)
    video.currentTime = 0
}

/** Starts preview playback on user intent and resets it when the preview deactivates. */
export function useVideoPreviewPlayback(enabled = true) {
  const [active, setActive] = useState(false)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)

  const videoRef: RefCallback<HTMLVideoElement> = useCallback((video) => {
    const previousVideo = videoElementRef.current
    if (previousVideo && previousVideo !== video)
      resetVideo(previousVideo)

    videoElementRef.current = video
    if (video)
      void video.play().catch(() => {})
  }, [])

  const activate = useCallback(() => {
    if (enabled)
      setActive(true)
  }, [enabled])

  const deactivate = useCallback(() => {
    setActive(false)
  }, [])

  const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      deactivate()
  }, [deactivate])

  return {
    active: enabled && active,
    onBlur,
    onFocus: activate,
    onMouseEnter: activate,
    onMouseLeave: deactivate,
    videoRef,
  }
}
