/** Immutable request-summary row displayed above one Create result group. */

import type { PromptTemplate } from '@talelabs/flows'
import type { FlowRunSummary, GenerationConfigResponse } from '@talelabs/sdk'

import { IconBug } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'
import { getResolvedLocale } from '../../../i18n/i18n'
import { PromptTemplatePreview } from '../../generation/prompt-composer/prompt-composer'
import {
  createRunInputLabel,
  createRunPromptInputs,
  createRunRequestTitle,
  createRunStatusKey,
} from './create-run-presentation'

/** Renders bounded provider-neutral facts from one immutable run snapshot. */
export function CreateRunRequestSummary({
  generationConfig,
  run,
  onReuseRequest,
}: {
  /** Sanitized catalog used only for labels. */
  generationConfig: GenerationConfigResponse
  /** Restores this immutable request into the mutable composer. */
  onReuseRequest: (run: FlowRunSummary) => void
  /** Bounded history row. */
  run: FlowRunSummary
}) {
  const { t } = useTranslation()
  const locale = getResolvedLocale()
  const prompt = run.requestSummary?.promptTemplates.prompt
  const submitted = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(run.createdAt))

  return (
    <header className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-xs font-medium text-muted-foreground">
          {createRunRequestTitle(run, generationConfig, t)}
        </h3>
        <span className="text-xs text-muted-foreground">{submitted}</span>
        <span className="ml-auto text-xs font-medium text-foreground/80">
          {t(createRunStatusKey(run.status))}
        </span>
      </div>
      {prompt && (
        <p className="mt-3 line-clamp-4 text-base/relaxed text-foreground/90">
          <PromptTemplatePreview
            inputs={createRunPromptInputs(run, t)}
            invalidTooltip={t('flows.promptComposer.invalid')}
            placeholder={t('create.history.noPrompt')}
            template={prompt as PromptTemplate}
          />
        </p>
      )}
      <div className="
        mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs
        text-muted-foreground
      "
      >
        {run.executionMode === 'debug' && (
          <span className="
            inline-flex items-center gap-1 font-medium text-warning
          "
          >
            <IconBug className="size-3.5" />
            {t('create.cost.mock')}
          </span>
        )}
        {run.requestSummary?.inputs.map(input => (
          <span key={input.slotId}>
            {createRunInputLabel(
              run,
              input.slotId,
              generationConfig,
              t,
            )}
            {': '}
            {input.assetIds.length}
          </span>
        ))}
        <Button
          className="h-auto p-0"
          size="xs"
          type="button"
          variant="link"
          onClick={() => onReuseRequest(run)}
        >
          {t('create.history.reuseRequest')}
        </Button>
      </div>
    </header>
  )
}
