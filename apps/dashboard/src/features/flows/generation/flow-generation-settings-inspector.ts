/** Presentation contract between node metadata and generation settings inspectors. */

import type { ComponentType } from 'react'
import type { CanvasNode } from '../editor/flow-canvas-types'

/** Model and adaptive settings resolved for inspector presentation. */
export interface FlowGenerationSettingsPresentation {
  icon: ComponentType<{ className?: string }>
  titleKey: string
}

/** Selected node and resolved presentation passed to a settings renderer. */
export interface FlowGenerationSettingsInspectorProps {
  node: CanvasNode
  presentation: FlowGenerationSettingsPresentation
}

/** React renderer contract shared by node-specific generation settings cards. */
export type FlowGenerationSettingsInspector = ComponentType<
  FlowGenerationSettingsInspectorProps
>
