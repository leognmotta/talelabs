/** Shared inspector composition for intent-specific audio model settings. */

import type { AudioIntentNodeType, FlowNodeType } from '@talelabs/flows'
import type { FlowGenerationSettingsInspectorProps } from '../../../generation/flow-generation-settings-inspector'

import { useNodeConnections } from '@xyflow/react'
import { AdaptiveGenerationSettingsCard } from '../../shared/settings/adaptive-generation-settings-card'
import { useAudioIntentNode } from '../use-audio-intent-node'

const AUDIO_INTENT_NODE_TYPES = new Set<FlowNodeType>([
  'musicGeneration',
  'soundEffectGeneration',
  'speechGeneration',
  'voiceChanger',
  'voiceIsolation',
])

function requireAudioIntentNodeType(type: FlowNodeType): AudioIntentNodeType {
  if (AUDIO_INTENT_NODE_TYPES.has(type))
    return type as AudioIntentNodeType
  throw new Error(`Expected an audio intent node, received ${type}`)
}

/** Displays active audio settings plus model selection and contract upgrade actions. */
export function AudioSettingsCard({
  node,
  presentation,
}: FlowGenerationSettingsInspectorProps) {
  const incomingConnections = useNodeConnections({
    handleType: 'target',
    id: node.id,
  })
  const audio = useAudioIntentNode({
    incomingConnections,
    node,
    nodeType: requireAudioIntentNodeType(node.type),
  })

  return (
    <AdaptiveGenerationSettingsCard
      activeSettings={audio.activeSettings}
      canUpgradeModelContract={audio.canUpgradeModelContract}
      model={audio.model}
      modelOptions={audio.modelOptions}
      normalizedSettings={audio.resolution?.normalizedSettings ?? null}
      presentation={presentation}
      onModelChange={audio.requestModelChange}
      onSettingChange={audio.updateSetting}
      onUpgrade={audio.upgradeModelContract}
    />
  )
}
