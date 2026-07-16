import type { ParsedFlowNodeData } from '../../graph/types.js'

import {
  getGenerationModel,
  isGenerationSettingValueValid,
} from '../../generation/registry/index.js'
import { getFlowNodeTypeDefinition } from '../registry/types.js'

export function migrateLegacyAudioGenerationNode(
  parsed: ParsedFlowNodeData,
): ParsedFlowNodeData {
  if (parsed.type !== 'audioGeneration')
    return parsed

  const legacyData = parsed.data
  const targetType = legacyData.modelId === 'talelabs/eleven-multilingual-v2'
    && legacyData.operationId === 'textToSpeech'
    ? 'speechGeneration'
    : legacyData.modelId === 'talelabs/eleven-sound-effects-v2'
      && legacyData.operationId === 'textToSoundEffect'
      ? 'soundEffectGeneration'
      : null
  if (!targetType)
    return parsed

  const migrationModelId = targetType === 'speechGeneration'
    ? 'talelabs/eleven-multilingual-v2'
    : 'talelabs/eleven-sound-effects-v2'
  const migrationContractVersion = '2026-07-15.14'
  const targetModel = getGenerationModel(
    migrationModelId,
    migrationContractVersion,
  )
  const targetOperation = targetModel?.operations.find(
    operation => operation.nodeType === targetType,
  )
  if (!targetModel || !targetOperation)
    throw new Error(`Missing migration model for ${targetType}`)
  const defaults = {
    inputSelections: Object.fromEntries(
      targetModel.inputSlots.map(slot => [
        slot.id,
        { mode: 'auto' as const },
      ]),
    ),
    modelContractVersion: migrationContractVersion,
    modelId: migrationModelId,
    operationId: targetOperation.id,
    prompt: '',
    settings: Object.fromEntries(
      targetModel.settings.map(setting => [setting.id, setting.default]),
    ),
  }

  const legacySettings
    = legacyData.settings && typeof legacyData.settings === 'object'
      ? legacyData.settings as Record<string, boolean | number | string>
      : {}
  const settings = Object.fromEntries(
    targetModel.settings.map((setting) => {
      const legacyValue = legacySettings[setting.id]
      return [
        setting.id,
        legacyValue !== undefined
        && isGenerationSettingValueValid(setting, legacyValue)
          ? legacyValue
          : setting.default,
      ]
    }),
  )
  if (
    targetType === 'soundEffectGeneration'
    && legacySettings.durationMode === undefined
    && typeof legacySettings.durationSeconds === 'number'
  ) {
    settings.durationMode = 'custom'
  }

  const legacySelections
    = legacyData.inputSelections && typeof legacyData.inputSelections === 'object'
      ? legacyData.inputSelections as Record<string, unknown>
      : {}
  const inputSelections = Object.fromEntries(
    Object.entries(defaults.inputSelections).map(([slotId, fallback]) => [
      slotId,
      legacySelections[slotId] ?? fallback,
    ]),
  )
  const targetDefinition = getFlowNodeTypeDefinition(targetType)
  const targetData = targetDefinition.schemas[targetDefinition.currentVersion]
    ?.parse({
      ...defaults,
      inputSelections,
      locked: legacyData.locked === true,
      settings,
    })
  if (!targetData)
    throw new Error(`Missing ${targetType} migration schema`)

  return {
    data: targetData as Record<string, unknown>,
    schemaVersion: targetDefinition.currentVersion,
    type: targetType,
  }
}
