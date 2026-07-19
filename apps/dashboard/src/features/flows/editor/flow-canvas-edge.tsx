/** Memoized custom edge presentation and direct edge deletion control. */

import type { EdgeProps } from '@xyflow/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { IconX } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from '@xyflow/react'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFlowCanvasReducedMotion } from './use-flow-canvas-reduced-motion'

const EDGE_PROJECTION_SAMPLES = 32
const EDGE_PROJECTION_REFINEMENTS = 8
const EDGE_RELEASE_DAMPING = 7
const EDGE_RELEASE_MAX_BEND = 48
const EDGE_RELEASE_MAX_DURATION = 1_200
const EDGE_RELEASE_MIN_BEND = 18
const EDGE_RELEASE_STIFFNESS = 180
const EDGE_RELEASE_PATH_NUMBER_PATTERN = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi

interface EdgeReleaseSpring {
  bend: number
  velocity: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function getInitialReleaseBend(distance: number, releaseAnimationId: number) {
  const direction = releaseAnimationId % 2 === 0 ? 1 : -1
  return direction * clamp(
    distance * 0.16,
    EDGE_RELEASE_MIN_BEND,
    EDGE_RELEASE_MAX_BEND,
  )
}

function bendEdgePath(path: string, bend: number): string {
  if (bend === 0)
    return path
  const points = path.match(EDGE_RELEASE_PATH_NUMBER_PATTERN)?.map(Number)
  if (!points || points.length !== 8)
    return path
  const [
    sourceX,
    sourceY,
    firstControlX,
    firstControlY,
    secondControlX,
    secondControlY,
    targetX,
    targetY,
  ] = points
  if (
    sourceX === undefined
    || sourceY === undefined
    || firstControlX === undefined
    || firstControlY === undefined
    || secondControlX === undefined
    || secondControlY === undefined
    || targetX === undefined
    || targetY === undefined
  ) {
    return path
  }
  const distance = Math.hypot(targetX - sourceX, targetY - sourceY)
  if (distance < 1)
    return path
  const perpendicularX = -(targetY - sourceY) / distance
  const perpendicularY = (targetX - sourceX) / distance
  return `M${sourceX},${sourceY} C${firstControlX + perpendicularX * bend * 0.32},${firstControlY + perpendicularY * bend * 0.32} ${secondControlX + perpendicularX * bend * 0.78},${secondControlY + perpendicularY * bend * 0.78} ${targetX},${targetY}`
}

function useEdgeReleaseBend(input: {
  distance: number
  reducedMotion: boolean
  releaseAnimationId?: number
}): number {
  const distanceRef = useRef(input.distance)
  distanceRef.current = input.distance
  const springRef = useRef<EdgeReleaseSpring>({ bend: 0, velocity: 0 })
  const [renderedBend, setRenderedBend] = useState(() => (
    input.reducedMotion || input.releaseAnimationId === undefined
      ? 0
      : getInitialReleaseBend(input.distance, input.releaseAnimationId)
  ))

  useLayoutEffect(() => {
    const bend = input.reducedMotion || input.releaseAnimationId === undefined
      ? 0
      : getInitialReleaseBend(
          distanceRef.current,
          input.releaseAnimationId,
        )
    springRef.current = { bend, velocity: 0 }
    const frame = requestAnimationFrame(() => setRenderedBend(bend))
    return () => cancelAnimationFrame(frame)
  }, [input.reducedMotion, input.releaseAnimationId])

  useEffect(() => {
    if (input.reducedMotion || input.releaseAnimationId === undefined)
      return
    let frame: number
    const startedAt = performance.now()
    let previousTime = startedAt
    const animate = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - previousTime) / 1000, 1 / 30)
      previousTime = currentTime
      const spring = springRef.current
      const acceleration = -EDGE_RELEASE_STIFFNESS * spring.bend
        - EDGE_RELEASE_DAMPING * spring.velocity
      spring.velocity += acceleration * deltaTime
      spring.bend += spring.velocity * deltaTime
      const settled = Math.abs(spring.bend) < 0.02
        && Math.abs(spring.velocity) < 0.2
      if (settled || currentTime - startedAt >= EDGE_RELEASE_MAX_DURATION) {
        springRef.current = { bend: 0, velocity: 0 }
        setRenderedBend(0)
        return
      }
      setRenderedBend(spring.bend)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [input.reducedMotion, input.releaseAnimationId])

  return input.reducedMotion ? 0 : renderedBend
}

function getSquaredDistance(
  path: SVGPathElement,
  length: number,
  pointer: { x: number, y: number },
) {
  const point = path.getPointAtLength(length)
  return (point.x - pointer.x) ** 2 + (point.y - pointer.y) ** 2
}

/** Projects the pointer onto the closest rendered point of the edge path. */
function projectPointerOntoEdge(
  path: SVGPathElement,
  pointer: { x: number, y: number },
) {
  const totalLength = path.getTotalLength()
  let nearestSample = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  for (let sample = 0; sample <= EDGE_PROJECTION_SAMPLES; sample += 1) {
    const length = totalLength * sample / EDGE_PROJECTION_SAMPLES
    const distance = getSquaredDistance(path, length, pointer)

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestSample = sample
    }
  }

  let lowerLength = totalLength * Math.max(0, nearestSample - 1) / EDGE_PROJECTION_SAMPLES
  let upperLength = totalLength * Math.min(EDGE_PROJECTION_SAMPLES, nearestSample + 1) / EDGE_PROJECTION_SAMPLES

  for (let refinement = 0; refinement < EDGE_PROJECTION_REFINEMENTS; refinement += 1) {
    const third = (upperLength - lowerLength) / 3
    const lowerCandidate = lowerLength + third
    const upperCandidate = upperLength - third

    if (
      getSquaredDistance(path, lowerCandidate, pointer)
      < getSquaredDistance(path, upperCandidate, pointer)
    ) {
      upperLength = upperCandidate
    }
    else {
      lowerLength = lowerCandidate
    }
  }

  const projected = path.getPointAtLength((lowerLength + upperLength) / 2)
  return { x: projected.x, y: projected.y }
}

/** Renders one memoized bezier edge and its contextual delete affordance. */
export const FlowCanvasEdge = memo(({
  data,
  deletable,
  id,
  interactionWidth,
  markerEnd,
  markerStart,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY,
}: EdgeProps<CanvasEdge>) => {
  const { t } = useTranslation()
  const reducedMotion = useFlowCanvasReducedMotion()
  const { deleteElements, screenToFlowPosition } = useReactFlow<CanvasNode, CanvasEdge>()
  const [hovered, setHovered] = useState(false)
  const [deletePosition, setDeletePosition] = useState<null | { x: number, y: number }>(null)
  const edgeGroupRef = useRef<SVGGElement>(null)
  const hideTimerRef = useRef<null | number>(null)
  const [settledPath] = getBezierPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  })
  const releaseBend = useEdgeReleaseBend({
    distance: Math.hypot(targetX - sourceX, targetY - sourceY),
    reducedMotion,
    releaseAnimationId: data?.releaseAnimationId,
  })
  const path = bendEdgePath(settledPath, releaseBend)

  function showDeleteButton() {
    if (hideTimerRef.current !== null)
      window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
    setHovered(true)
  }

  function trackDeleteButton(event: ReactPointerEvent) {
    const pointerStillIntersectsEdge = document
      .elementsFromPoint(event.clientX, event.clientY)
      .some(element => edgeGroupRef.current?.contains(element))

    if (!pointerStillIntersectsEdge) {
      scheduleDeleteButtonHide()
      return
    }

    const pointerPosition = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })
    const edgePath = edgeGroupRef.current
      ?.querySelector<SVGPathElement>('.react-flow__edge-path')

    setDeletePosition(edgePath
      ? projectPointerOntoEdge(edgePath, pointerPosition)
      : pointerPosition)
    showDeleteButton()
  }

  function scheduleDeleteButtonHide() {
    if (hideTimerRef.current !== null)
      window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(setHovered, 240, false)
  }

  useEffect(() => () => {
    if (hideTimerRef.current !== null)
      window.clearTimeout(hideTimerRef.current)
  }, [])

  return (
    <>
      <g
        ref={edgeGroupRef}
        onPointerEnter={trackDeleteButton}
        onPointerLeave={scheduleDeleteButtonHide}
        onPointerMove={trackDeleteButton}
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
      {hovered && deletePosition !== null && deletable !== false && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan nowheel pointer-events-auto absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${deletePosition.x}px, ${deletePosition.y}px)`,
            }}
            onPointerEnter={showDeleteButton}
            onPointerLeave={scheduleDeleteButtonHide}
            onPointerMove={trackDeleteButton}
          >
            <Tooltip>
              <TooltipTrigger
                render={(
                  <Button
                    aria-label={t('common.delete')}
                    className="size-7 rounded-full shadow-md"
                    size="icon-sm"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      void deleteElements({ edges: [{ id }] })
                    }}
                  />
                )}
              >
                <IconX aria-hidden />
              </TooltipTrigger>
              <TooltipContent side="right">{t('common.delete')}</TooltipContent>
            </Tooltip>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})
