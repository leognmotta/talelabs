import type { EdgeProps } from '@xyflow/react'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { IconX } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function FlowCanvasEdge({
  deletable,
  id,
  interactionWidth,
  markerEnd,
  markerStart,
  selected,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<CanvasEdge>) {
  const { t } = useTranslation()
  const { deleteElements } = useReactFlow<CanvasNode, CanvasEdge>()
  const [hovered, setHovered] = useState(false)
  const hideTimerRef = useRef<null | number>(null)
  const [path, labelX, labelY] = getBezierPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  })

  function showDeleteButton() {
    if (hideTimerRef.current !== null)
      window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
    setHovered(true)
  }

  function scheduleDeleteButtonHide() {
    if (hideTimerRef.current !== null)
      window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(setHovered, 120, false)
  }

  useEffect(() => () => {
    if (hideTimerRef.current !== null)
      window.clearTimeout(hideTimerRef.current)
  }, [])

  return (
    <>
      <g
        onPointerEnter={showDeleteButton}
        onPointerLeave={scheduleDeleteButtonHide}
      >
        <BaseEdge
          id={id}
          interactionWidth={interactionWidth}
          markerEnd={markerEnd}
          markerStart={markerStart}
          path={path}
          style={style}
        />
      </g>
      {(selected || hovered) && deletable !== false && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan nowheel pointer-events-auto absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onPointerEnter={showDeleteButton}
            onPointerLeave={scheduleDeleteButtonHide}
          >
            <Button
              aria-label={t('common.delete')}
              className="size-7 rounded-full shadow-md"
              size="icon-sm"
              title={t('common.delete')}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                void deleteElements({ edges: [{ id }] })
              }}
            >
              <IconX aria-hidden className="size-4" />
            </Button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
