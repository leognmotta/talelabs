/** Frame-boundary icons used by first-frame and last-frame Flow handles. */

import type { ComponentProps } from 'react'

type FrameIconProps = Omit<ComponentProps<'svg'>, 'stroke'> & { stroke?: number }

function FrameBoundaryIcon({
  markerPosition,
  stroke = 2,
  ...props
}: FrameIconProps & { markerPosition: 'left' | 'right' }) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={stroke}
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M8 5H5v14h3" />
      <path d="M16 5h3v14h-3" />
      <path d={markerPosition === 'left' ? 'M10 8v8' : 'M14 8v8'} />
    </svg>
  )
}

/** Marks the leading frame boundary for a first-frame input handle. */
export function FirstFrameIcon(props: FrameIconProps) {
  return <FrameBoundaryIcon markerPosition="left" {...props} />
}

/** Marks the trailing frame boundary for a last-frame input handle. */
export function LastFrameIcon(props: FrameIconProps) {
  return <FrameBoundaryIcon markerPosition="right" {...props} />
}
