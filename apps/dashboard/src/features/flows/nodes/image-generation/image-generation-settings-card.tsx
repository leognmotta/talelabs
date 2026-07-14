import type { FlowGenerationSettingsInspectorProps } from '../../flow-generation-settings-inspector'
import { useNodeConnections } from '@xyflow/react'
import { AdaptiveGenerationSettingsCard } from '../adaptive-generation-settings-card'
import { useImageGenerationNode } from './use-image-generation-node'

export function ImageGenerationSettingsCard({
  node,
  presentation,
}: FlowGenerationSettingsInspectorProps) {
  const incomingConnections = useNodeConnections({
    handleType: 'target',
    id: node.id,
  })
  const image = useImageGenerationNode({ incomingConnections, node })

  return (
    <AdaptiveGenerationSettingsCard
      activeSettings={image.activeSettings}
      canUpgradeModelContract={image.canUpgradeModelContract}
      model={image.model}
      modelOptions={image.modelOptions}
      normalizedSettings={image.resolution?.normalizedSettings ?? null}
      presentation={presentation}
      onModelChange={image.requestModelChange}
      onSettingChange={image.updateSetting}
      onUpgrade={image.upgradeModelContract}
    />
  )
}
