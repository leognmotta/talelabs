/** Catalog-backed model selection presented directly inside Create's composer. */

import type { GenerationModelDefinition } from '@talelabs/flows'
import type { GenerationConfigResponse } from '@talelabs/sdk'
import type { CreateDraft } from './create-draft'
import type { CreateDraftResolution } from './create-resolution'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ModelPicker } from '../generation/model-picker'
import { createModelsForDraft } from './create-resolution'

/** Renders only models compatible with the current Create media intent. */
export function CreateModelPicker({
  draft,
  generationConfig,
  resolution,
  onModelChange,
}: {
  /** Current request whose mode constrains compatible catalog models. */
  draft: CreateDraft
  /** Sanitized catalog projection used to disable unavailable models. */
  generationConfig: GenerationConfigResponse
  /** Current model resolution used for the selected presentation label. */
  resolution: CreateDraftResolution
  /** Applies one existing catalog model to the provider-neutral draft. */
  onModelChange: (model: GenerationModelDefinition) => void
}) {
  const { t } = useTranslation()
  const models = useMemo(() => createModelsForDraft(draft), [draft])
  const enabledIds = useMemo(
    () => new Set(
      generationConfig.models
        .filter(model => model.enabled)
        .map(model => model.id),
    ),
    [generationConfig.models],
  )
  const options = useMemo(() => models.map(model => ({
    capabilities: model.operations.map(operation => t(operation.labelKey)),
    category: {
      id: model.mediaType,
      label: t(`assets.types.${model.mediaType}` as 'assets.types.image'),
    },
    description: model.presentation
      ? t(model.presentation.descriptionKey)
      : model.displayName,
    disabled: !enabledIds.has(model.id) || model.executionAvailable === false,
    id: model.id,
    label: t(model.labelKey),
    logoId: model.presentation?.logoId ?? 'llm',
    recommended: model.recommended,
  })), [enabledIds, models, t])

  return (
    <ModelPicker
      ariaLabel={t('flows.model')}
      emptyMessage={t('flows.modelPicker.noResults')}
      options={options}
      recommendedLabel={t('flows.modelPicker.recommended')}
      searchAriaLabel={t('flows.modelPicker.searchLabel')}
      searchPlaceholder={t('flows.modelPicker.searchPlaceholder')}
      selectedLabel={resolution.model ? t(resolution.model.labelKey) : ''}
      triggerClassName="h-8 border-0 bg-transparent px-2 hover:bg-muted/50"
      unavailableLabel={t('flows.modelPicker.unavailable')}
      value={draft.modelId}
      onValueChange={(modelId) => {
        const model = models.find(item => item.id === modelId)
        if (model)
          onModelChange(model)
      }}
    />
  )
}
