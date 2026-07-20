/** Typed React Flow handle with semantic icon, label, and connection count. */

import type { FlowValueType } from '@talelabs/flows'

import { IconSparkles } from '@tabler/icons-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import { Handle, Position } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import {
  HANDLE_ICONS_BY_ID,
  HANDLE_ICONS_BY_VALUE_TYPE,
} from './flow-handle-icons'

/** Renders a typed React Flow handle with stable icons and connection count. */
export function FlowHandle({
  ariaLabel,
  connectionCount = 0,
  disabled = false,
  id,
  nodeEdge = false,
  showConnectionCount = true,
  side,
  tooltip,
  valueType,
}: {
  ariaLabel: string
  connectionCount?: number
  disabled?: boolean
  id: string
  nodeEdge?: boolean
  showConnectionCount?: boolean
  side: 'input' | 'output'
  tooltip?: string
  valueType: FlowValueType
}) {
  const previousConnectionCountRef = useRef(connectionCount)
  const [connectionAccepted, setConnectionAccepted] = useState(false)
  const Icon = HANDLE_ICONS_BY_ID[id as keyof typeof HANDLE_ICONS_BY_ID]
    ?? HANDLE_ICONS_BY_VALUE_TYPE[valueType]
    ?? IconSparkles

  useEffect(() => {
    const previousConnectionCount = previousConnectionCountRef.current
    previousConnectionCountRef.current = connectionCount
    if (side !== 'input' || connectionCount <= previousConnectionCount)
      return
    let startFrame: number | undefined
    let resetTimer: number | undefined
    const clearFrame = requestAnimationFrame(() => {
      setConnectionAccepted(false)
      startFrame = requestAnimationFrame(() => {
        setConnectionAccepted(true)
        resetTimer = window.setTimeout(setConnectionAccepted, 400, false)
      })
    })
    return () => {
      cancelAnimationFrame(clearFrame)
      if (startFrame !== undefined)
        cancelAnimationFrame(startFrame)
      if (resetTimer !== undefined)
        window.clearTimeout(resetTimer)
    }
  }, [connectionCount, side])

  const handle = (
    <Handle
      aria-label={ariaLabel}
      aria-disabled={disabled}
      data-connection-accepted={connectionAccepted || undefined}
      data-flow-handle
      data-connected={connectionCount > 0 || undefined}
      data-disabled={disabled || undefined}
      data-side={side}
      data-value-type={valueType}
      id={id}
      isConnectable={!disabled}
      isConnectableEnd={!disabled}
      isConnectableStart={!disabled}
      position={side === 'input' ? Position.Left : Position.Right}
      type={side === 'input' ? 'target' : 'source'}
      className="
        pointer-events-auto! flex! size-8! items-center! justify-center!
        rounded-full! border-2! border-(--flow-node-surface)!
        transition-[transform,scale,opacity,box-shadow]
        duration-(--flow-motion-fast) ease-(--flow-motion-ease)
        data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-35
      "
      style={side === 'input'
        ? { left: nodeEdge ? '-1.5rem' : 'calc(-0.75rem - 1.5rem)' }
        : { right: nodeEdge ? '-1.5rem' : 'calc(-0.75rem - 1.5rem)' }}
    >
      <Icon
        aria-hidden
        className="pointer-events-none size-4"
        stroke={1.8}
      />
      {showConnectionCount && connectionCount > 0 && (
        <span className="
          pointer-events-none absolute -right-1 -bottom-1 flex size-4
          items-center justify-center rounded-full bg-foreground text-[9px]
          font-semibold text-background ring-2 ring-(--flow-node-surface)
        "
        >
          {connectionCount}
        </span>
      )}
    </Handle>
  )

  if (!tooltip)
    return handle

  return (
    <Tooltip>
      <TooltipTrigger render={handle} />
      <TooltipContent
        align="center"
        side={side === 'input' ? 'right' : 'left'}
        sideOffset={10}
      >
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
