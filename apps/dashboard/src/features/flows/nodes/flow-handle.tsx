import type { FlowValueType } from '@talelabs/flows'
import type { ComponentProps } from 'react'
import {
  IconComponents,
  IconFile,
  IconHeadphones,
  IconPhoto,
  IconSparkles,
  IconTextCaption,
  IconVideo,
} from '@tabler/icons-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import { Handle, Position } from '@xyflow/react'

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

function FirstFrameIcon(props: FrameIconProps) {
  return <FrameBoundaryIcon markerPosition="left" {...props} />
}

function LastFrameIcon(props: FrameIconProps) {
  return <FrameBoundaryIcon markerPosition="right" {...props} />
}

const HANDLE_ICONS_BY_ID = {
  audio: IconHeadphones,
  audioReferences: IconHeadphones,
  context: IconComponents,
  firstFrame: FirstFrameIcon,
  imageReferences: IconPhoto,
  images: IconPhoto,
  lastFrame: LastFrameIcon,
  videoReferences: IconVideo,
  videos: IconVideo,
} as const

const HANDLE_ICONS_BY_VALUE_TYPE = {
  Asset: IconFile,
  AudioSet: IconHeadphones,
  ElementContext: IconComponents,
  ImageSet: IconPhoto,
  Text: IconTextCaption,
  VideoSet: IconVideo,
} as const satisfies Record<FlowValueType, typeof IconSparkles>

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
  const Icon = HANDLE_ICONS_BY_ID[id as keyof typeof HANDLE_ICONS_BY_ID]
    ?? HANDLE_ICONS_BY_VALUE_TYPE[valueType]
    ?? IconSparkles
  const handle = (
    <Handle
      aria-label={ariaLabel}
      aria-disabled={disabled}
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
        transition-[transform,opacity,box-shadow]
        data-connectionindicator:hover:scale-110
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
