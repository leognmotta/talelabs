import type { ComponentType } from 'react'
import type { CanvasNode } from './flow-canvas-types'

export interface FlowGenerationSettingsPresentation {
  icon: ComponentType<{ className?: string }>
  titleKey: string
}

export interface FlowGenerationSettingsInspectorProps {
  node: CanvasNode
  presentation: FlowGenerationSettingsPresentation
}

export type FlowGenerationSettingsInspector = ComponentType<
  FlowGenerationSettingsInspectorProps
>
