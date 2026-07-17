/** Inspector card shell selected by canonical generation node metadata. */

import type { CanvasNode } from '../editor/flow-canvas-types'

import { getFlowDashboardNodeDefinition } from '../nodes/flow-dashboard-node-registry'

/** Selects the settings inspector registered for the current generation node type. */
export function FlowGenerationSettingsCard({ node }: { node: CanvasNode }) {
  const definition = getFlowDashboardNodeDefinition(node.type)
  const Inspector = definition.generationSettings
  if (!Inspector)
    return null
  return (
    <Inspector
      node={node}
      presentation={{
        icon: definition.icon,
        titleKey: definition.labelKey,
      }}
    />
  )
}
