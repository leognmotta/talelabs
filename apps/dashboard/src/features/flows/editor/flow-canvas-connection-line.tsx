/** Spring-driven temporary connection wire for the Flow canvas. */

import type { ConnectionLineComponentProps } from '@xyflow/react'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses its connection-path class as a styling hook. */

import { Position } from '@xyflow/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useFlowCanvasReducedMotion } from './use-flow-canvas-reduced-motion'

const ELASTIC_DAMPING = 12
const ELASTIC_MAX_BEND = 80
const ELASTIC_MAX_VELOCITY = 900
const ELASTIC_POINTER_IMPULSE = 0.28
const ELASTIC_STIFFNESS = 105
const ELASTIC_VELOCITY_IMPULSE = 8

interface ElasticSpring {
  bend: number
  velocity: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function positionVector(position: Position): { x: number, y: number } {
  switch (position) {
    case Position.Left:
      return { x: -1, y: 0 }
    case Position.Right:
      return { x: 1, y: 0 }
    case Position.Top:
      return { x: 0, y: -1 }
    case Position.Bottom:
      return { x: 0, y: 1 }
  }
}

function buildElasticPath(input: {
  bend: number
  fromPosition: Position
  fromX: number
  fromY: number
  toPosition: Position
  toX: number
  toY: number
}): string {
  const deltaX = input.toX - input.fromX
  const deltaY = input.toY - input.fromY
  const distance = Math.max(1, Math.hypot(deltaX, deltaY))
  const perpendicularX = -deltaY / distance
  const perpendicularY = deltaX / distance
  const controlDistance = clamp(distance * 0.42, 24, 180)
  const bendLimit = Math.min(ELASTIC_MAX_BEND, Math.max(12, distance * 0.28))
  const bend = clamp(input.bend, -bendLimit, bendLimit)
  const fromDirection = positionVector(input.fromPosition)
  const toDirection = positionVector(input.toPosition)
  const firstControlX = input.fromX
    + fromDirection.x * controlDistance
    + perpendicularX * bend * 0.32
  const firstControlY = input.fromY
    + fromDirection.y * controlDistance
    + perpendicularY * bend * 0.32
  const secondControlX = input.toX
    + toDirection.x * controlDistance
    + perpendicularX * bend * 0.78
  const secondControlY = input.toY
    + toDirection.y * controlDistance
    + perpendicularY * bend * 0.78
  return `M ${input.fromX},${input.fromY} C ${firstControlX},${firstControlY} ${secondControlX},${secondControlY} ${input.toX},${input.toY}`
}

/** Renders a pointer-precise connection wire whose bend trails and settles. */
export function FlowCanvasConnectionLine({
  connectionLineStyle,
  fromPosition,
  fromX,
  fromY,
  toPosition,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  const reducedMotion = useFlowCanvasReducedMotion()
  const previousPointerRef = useRef({ x: toX, y: toY })
  const springRef = useRef<ElasticSpring>({ bend: 0, velocity: 0 })
  const [renderedBend, setRenderedBend] = useState(0)

  useLayoutEffect(() => {
    const previousPointer = previousPointerRef.current
    previousPointerRef.current = { x: toX, y: toY }
    if (reducedMotion)
      return
    const pointerDeltaX = toX - previousPointer.x
    const pointerDeltaY = toY - previousPointer.y
    const chordX = toX - fromX
    const chordY = toY - fromY
    const chordLength = Math.hypot(chordX, chordY)
    if (chordLength < 1)
      return
    const perpendicularX = -chordY / chordLength
    const perpendicularY = chordX / chordLength
    const lateralPointerDelta = pointerDeltaX * perpendicularX
      + pointerDeltaY * perpendicularY
    const spring = springRef.current
    spring.bend = clamp(
      spring.bend - lateralPointerDelta * ELASTIC_POINTER_IMPULSE,
      -ELASTIC_MAX_BEND,
      ELASTIC_MAX_BEND,
    )
    spring.velocity = clamp(
      spring.velocity - lateralPointerDelta * ELASTIC_VELOCITY_IMPULSE,
      -ELASTIC_MAX_VELOCITY,
      ELASTIC_MAX_VELOCITY,
    )
  }, [fromX, fromY, reducedMotion, toX, toY])

  useEffect(() => {
    if (reducedMotion) {
      springRef.current = { bend: 0, velocity: 0 }
      const frame = requestAnimationFrame(() => setRenderedBend(0))
      return () => cancelAnimationFrame(frame)
    }
    let frame: number
    let previousTime = performance.now()
    const animate = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - previousTime) / 1000, 1 / 30)
      previousTime = currentTime
      const spring = springRef.current
      const acceleration = -ELASTIC_STIFFNESS * spring.bend
        - ELASTIC_DAMPING * spring.velocity
      spring.velocity += acceleration * deltaTime
      spring.bend += spring.velocity * deltaTime
      if (Math.abs(spring.bend) < 0.02 && Math.abs(spring.velocity) < 0.02) {
        spring.bend = 0
        spring.velocity = 0
      }
      setRenderedBend(current => (
        Math.abs(current - spring.bend) > 0.01 ? spring.bend : current
      ))
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [reducedMotion])

  const path = buildElasticPath({
    bend: reducedMotion ? 0 : renderedBend,
    fromPosition,
    fromX,
    fromY,
    toPosition,
    toX,
    toY,
  })

  return (
    <path
      aria-hidden
      className="react-flow__connection-path"
      d={path}
      data-elastic-connection-line
      fill="none"
      style={connectionLineStyle}
    />
  )
}
