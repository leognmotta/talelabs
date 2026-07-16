import type {
  GenerationModelDefinition,
  GenerationSettingDefinition,
  GenerationSettingValue,
} from '@talelabs/flows'
import type { ModelPickerOption } from '../../generation/model-picker'
import type { FlowGenerationSettingsPresentation } from '../flow-generation-settings-inspector'

import { useTranslation } from 'react-i18next'
import { GenerationSettingsCard } from './generation-settings-card'
import { GenerationSettingsList } from './generation-settings-list'

export function AdaptiveGenerationSettingsCard({
  activeSettings,
  canUpgradeModelContract,
  model,
  modelOptions,
  normalizedSettings,
  presentation,
  onModelChange,
  onSettingChange,
  onUpgrade,
}: {
  activeSettings: readonly GenerationSettingDefinition[]
  canUpgradeModelContract: boolean
  model: GenerationModelDefinition | undefined
  modelOptions: ModelPickerOption[]
  normalizedSettings: null | Readonly<Record<string, GenerationSettingValue>>
  onModelChange: (modelId: string) => void
  onSettingChange: (settingId: string, value: GenerationSettingValue) => void
  onUpgrade: () => void
  presentation: FlowGenerationSettingsPresentation
}) {
  const { t } = useTranslation()
  if (!model || !normalizedSettings)
    return null

  const showModelPicker = modelOptions.length > 1
  const hasConfiguration = showModelPicker
    || canUpgradeModelContract
    || activeSettings.length > 0
  if (!hasConfiguration)
    return null

  return (
    <GenerationSettingsCard
      ariaLabel={t('flows.settings.label')}
      emptyMessage={t('flows.modelPicker.noResults')}
      icon={presentation.icon}
      modelAriaLabel={t('flows.model')}
      modelOptions={modelOptions}
      recommendedLabel={t('flows.modelPicker.recommended')}
      searchAriaLabel={t('flows.modelPicker.searchLabel')}
      searchPlaceholder={t('flows.modelPicker.searchPlaceholder')}
      selectedModelLabel={t(model.labelKey)}
      showModelPicker={showModelPicker}
      title={t(presentation.titleKey)}
      unavailableLabel={t('flows.modelPicker.unavailable')}
      upgradeLabel={t('flows.modelChange.update')}
      value={model.id}
      onModelChange={onModelChange}
      onUpgrade={canUpgradeModelContract ? onUpgrade : undefined}
    >
      <GenerationSettingsList
        layout={showModelPicker || canUpgradeModelContract
          ? 'afterControls'
          : 'standalone'}
        settings={activeSettings}
        values={normalizedSettings}
        onValueChange={onSettingChange}
      />
    </GenerationSettingsCard>
  )
}
