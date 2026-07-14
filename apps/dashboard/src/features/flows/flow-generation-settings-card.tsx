import type { CanvasNode } from './flow-canvas-types'

import { getFlowDashboardNodeDefinition } from './flow-dashboard-node-registry'

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
