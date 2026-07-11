import type { FocusEvent, RefCallback } from 'react'

import { useCallback, useRef, useState } from 'react'

function releaseVideo(video: HTMLVideoElement) {
  video.pause()
  video.removeAttribute('src')
  video.load()
}

export function useVideoPreviewPlayback(enabled = true) {
  const [active, setActive] = useState(false)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)

  const videoRef: RefCallback<HTMLVideoElement> = useCallback((video) => {
    const previousVideo = videoElementRef.current
    if (previousVideo && previousVideo !== video)
      releaseVideo(previousVideo)

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
