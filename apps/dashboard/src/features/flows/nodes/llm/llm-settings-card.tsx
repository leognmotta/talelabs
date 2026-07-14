import type { FlowGenerationSettingsInspectorProps } from '../../flow-generation-settings-inspector'
import { useNodeConnections } from '@xyflow/react'
import { AdaptiveGenerationSettingsCard } from '../adaptive-generation-settings-card'
import { useLlmNode } from './use-llm-node'

export function LlmSettingsCard({
  node,
  presentation,
}: FlowGenerationSettingsInspectorProps) {
  const incomingConnections = useNodeConnections({
    handleType: 'target',
    id: node.id,
  })
  const llm = useLlmNode({ incomingConnections, node })

  return (
    <AdaptiveGenerationSettingsCard
      activeSettings={llm.activeSettings}
      canUpgradeModelContract={llm.canUpgradeModelContract}
      model={llm.model}
      modelOptions={llm.modelOptions}
      normalizedSettings={llm.resolution?.normalizedSettings ?? null}
      presentation={presentation}
      onModelChange={llm.requestModelChange}
      onSettingChange={llm.updateSetting}
      onUpgrade={llm.upgradeModelContract}
    />
  )
}
