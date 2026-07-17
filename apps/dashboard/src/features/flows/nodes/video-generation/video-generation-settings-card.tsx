/** Video inspector composition for model, derived operation, and active settings. */

import type { FlowGenerationSettingsInspectorProps } from '../../generation/flow-generation-settings-inspector'
import { useNodeConnections } from '@xyflow/react'
import { AdaptiveGenerationSettingsCard } from '../shared/settings/adaptive-generation-settings-card'
import { useVideoGenerationNode } from './use-video-generation-node'

/** Displays active video operation settings and model transition controls. */
export function VideoGenerationSettingsCard({
  node,
  presentation,
}: FlowGenerationSettingsInspectorProps) {
  const incomingConnections = useNodeConnections({
    handleType: 'target',
    id: node.id,
  })
  const video = useVideoGenerationNode({ incomingConnections, node })

  return (
    <AdaptiveGenerationSettingsCard
      activeSettings={video.activeSettings}
      canUpgradeModelContract={video.canUpgradeModelContract}
      model={video.model}
      modelOptions={video.modelOptions}
      normalizedSettings={video.resolution ? node.data.settings ?? {} : null}
      presentation={presentation}
      onModelChange={video.requestModelChange}
      onSettingChange={video.updateSetting}
      onUpgrade={video.upgradeModelContract}
    />
  )
}
