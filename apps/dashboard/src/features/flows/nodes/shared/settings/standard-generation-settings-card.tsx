/** Standard inspector composition for model selection, operation, and settings. */

import type { FlowGenerationSettingsInspectorProps } from '../../../generation/flow-generation-settings-inspector'

import { useTranslation } from 'react-i18next'
import { useFlowGenerationSettings } from '../../../generation/use-flow-generation-settings'
import { GenerationOperationField } from './generation-operation-field'
import { GenerationSettingsCard } from './generation-settings-card'
import { GenerationSettingsList } from './generation-settings-list'

/** Displays generic catalog settings for generation families without a specialized card. */
export function StandardGenerationSettingsCard({
  node,
  presentation,
}: FlowGenerationSettingsInspectorProps) {
  const { t } = useTranslation()
  const settings = useFlowGenerationSettings(node)

  if (!settings.model)
    return null

  return (
    <GenerationSettingsCard
      ariaLabel={t('flows.settings.label')}
      emptyMessage={t('flows.modelPicker.noResults')}
      icon={presentation.icon}
      modelAriaLabel={t('flows.model')}
      modelOptions={settings.modelOptions}
      recommendedLabel={t('flows.modelPicker.recommended')}
      searchAriaLabel={t('flows.modelPicker.searchLabel')}
      searchPlaceholder={t('flows.modelPicker.searchPlaceholder')}
      selectedModelLabel={t(settings.model.labelKey)}
      title={t(presentation.titleKey)}
      unavailableLabel={t('flows.modelPicker.unavailable')}
      upgradeLabel={t('flows.modelChange.update')}
      value={settings.model.id}
      onModelChange={settings.updateModel}
      onUpgrade={settings.canUpgradeModelContract
        ? settings.upgradeModelContract
        : undefined}
    >
      {settings.model.operations.length > 1 && settings.operation && (
        <GenerationOperationField
          model={settings.model}
          operationId={settings.operation.id}
          onOperationChange={settings.updateOperation}
        />
      )}
      <GenerationSettingsList
        settings={settings.activeSettings}
        values={node.data.settings ?? {}}
        onValueChange={settings.updateSetting}
      />
    </GenerationSettingsCard>
  )
}
