/** Image inspector composition for model, derived operation, and active settings. */

import type { FlowGenerationSettingsInspectorProps } from '../../generation/flow-generation-settings-inspector'
import { useNodeConnections } from '@xyflow/react'
import { AdaptiveGenerationSettingsCard } from '../shared/settings/adaptive-generation-settings-card'
import { useImageGenerationNode } from './use-image-generation-node'

/** Displays active image settings plus model selection and contract upgrade actions. */
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
