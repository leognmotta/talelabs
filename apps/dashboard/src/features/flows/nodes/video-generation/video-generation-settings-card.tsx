import type { FlowGenerationSettingsInspectorProps } from '../../flow-generation-settings-inspector'
import { useNodeConnections } from '@xyflow/react'
import { AdaptiveGenerationSettingsCard } from '../adaptive-generation-settings-card'
import { useVideoGenerationNode } from './use-video-generation-node'

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
