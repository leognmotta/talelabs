/** Provider-neutral labels and prompt inputs for Create run-history rows. */

import type { FlowRunSummary, GenerationConfigResponse } from '@talelabs/sdk'
import type { TFunction } from 'i18next'
import type { PromptComposerInput } from '../../generation/prompt-composer/prompt-composer-types'

/** Returns the localized status key for one durable run state. */
export function createRunStatusKey(status: FlowRunSummary['status']) {
  return `create.runStatus.${status}` as 'create.runStatus.running'
}

/** Builds the compact model, operation, and output-count request title. */
export function createRunRequestTitle(
  run: FlowRunSummary,
  config: GenerationConfigResponse,
  t: TFunction,
) {
  const summary = run.requestSummary
  if (!summary)
    return t('create.history.request')
  const model = config.models.find(item => item.id === summary.modelId)
  const operation = model?.capabilities.operations.find(
    item => item.id === summary.operationId,
  )
  return t('create.history.requestTitle', {
    model: model ? t(model.labelKey) : summary.modelId,
    operation: operation ? t(operation.labelKey) : summary.operationId,
    count: summary.outputCount,
  })
}

/** Projects bounded immutable media inputs into read-only prompt chips. */
export function createRunPromptInputs(
  run: FlowRunSummary,
  t: TFunction,
): PromptComposerInput[] {
  return run.requestSummary?.inputs.flatMap(input => input.mediaTypes.map(
    (mediaType, index) => ({
      index,
      mediaType,
      name: t(
        `flows.promptComposer.references.${mediaType}` as 'flows.promptComposer.references.image',
        { index: index + 1 },
      ),
      previewUrl: null,
      slotId: input.slotId,
    }),
  )) ?? []
}

/** Resolves one immutable input slot through the sanitized model catalog. */
export function createRunInputLabel(
  run: FlowRunSummary,
  slotId: string,
  config: GenerationConfigResponse,
  t: TFunction,
) {
  const model = config.models.find(item => item.id === run.requestSummary?.modelId)
  const slot = model?.capabilities.inputSlots.find(item => item.role === slotId)
  return slot ? t(slot.labelKey) : t('create.history.mediaInput')
}
