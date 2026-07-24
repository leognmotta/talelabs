/** Command-oriented direct media composer for Image, Video, and Audio. */

import type {
  GenerationModelDefinition,
  GenerationSettingValue,
  PromptTemplate,
} from '@talelabs/flows'
import type { GenerationConfigResponse } from '@talelabs/sdk'
import type { GenerationRunCostEstimateState } from '../generation/runs/use-saved-generation-run-cost-estimate'
import type { CreateAttachment, CreateDraft, CreateMode } from './create-draft'
import type { CreateDraftResolution } from './create-resolution'

import {
  IconAdjustmentsHorizontal,
  IconBug,
  IconPhoto,
  IconSparkles,
  IconVideo,
  IconWaveSine,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Label } from '@talelabs/ui/components/label'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@talelabs/ui/components/popover'
import { Switch } from '@talelabs/ui/components/switch'
import { Tabs, TabsList, TabsTrigger } from '@talelabs/ui/components/tabs'
import { Textarea } from '@talelabs/ui/components/textarea'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@talelabs/ui/components/toggle-group'
import { useTranslation } from 'react-i18next'
import { GenerationSettingsList } from '../generation/configuration/generation-settings-list'
import { PromptComposer } from '../generation/prompt-composer/prompt-composer'
import { GenerationRunCostEstimate } from '../generation/runs/generation-run-cost-estimate'
import { CreateAttachments } from './create-attachments'
import {
  CREATE_AUDIO_INTENTS,
  createNodeType,
} from './create-draft'
import { CreateModelPicker } from './create-model-picker'

function acceptsPrompt(draft: CreateDraft) {
  return !['voiceChanger', 'voiceIsolation'].includes(
    createNodeType(draft.mode, draft.audioIntent),
  )
}

function promptLabelKey(draft: CreateDraft) {
  if (draft.mode === 'image')
    return 'create.composer.imageLabel'
  if (draft.mode === 'video')
    return 'create.composer.videoLabel'
  if (draft.audioIntent === 'speechGeneration')
    return 'create.composer.speechLabel'
  if (draft.audioIntent === 'musicGeneration')
    return 'create.composer.musicLabel'
  return 'create.composer.soundEffectLabel'
}

function promptPlaceholderKey(draft: CreateDraft) {
  if (draft.mode === 'image')
    return 'create.composer.imagePlaceholder'
  if (draft.mode === 'video')
    return 'create.composer.videoPlaceholder'
  if (draft.audioIntent === 'speechGeneration')
    return 'create.composer.speechPlaceholder'
  if (draft.audioIntent === 'musicGeneration')
    return 'create.composer.musicPlaceholder'
  return 'create.composer.soundEffectPlaceholder'
}

/** Renders one explicit media command and its catalog-derived controls. */
export function CreateComposer({
  blockingReason,
  canUseDebugMode,
  debugMode,
  disabled,
  draft,
  estimateState,
  generationConfig,
  resolution,
  onAddAttachment,
  onAudioIntentChange,
  onDebugModeChange,
  onGenerate,
  onLyricsChange,
  onModeChange,
  onModelChange,
  onPromptChange,
  onRemoveAttachment,
  onReorderAttachments,
  onSettingChange,
}: {
  /** Readiness condition preventing the current request from running. */
  blockingReason: null | string
  /** Existing account capability controlling debug-toggle visibility. */
  canUseDebugMode: boolean
  /** Whether deterministic mock output is selected for the next run. */
  debugMode: boolean
  /** Admission guard against duplicate commands. */
  disabled: boolean
  /** Current provider-neutral request. */
  draft: CreateDraft
  /** Canonical direct-request estimate state. */
  estimateState: GenerationRunCostEstimateState
  /** Sanitized catalog projection used to disable unavailable models. */
  generationConfig: GenerationConfigResponse
  /** Existing model-capability resolution. */
  resolution: CreateDraftResolution
  /** Adds one stable browser-local Asset input. */
  onAddAttachment: (attachment: CreateAttachment) => void
  /** Changes the registered Audio node intent. */
  onAudioIntentChange: (intent: CreateDraft['audioIntent']) => void
  /** Updates the URL-backed debug choice for the next request. */
  onDebugModeChange: (enabled: boolean) => void
  /** Admits one direct request after required cost estimation. */
  onGenerate: () => void
  /** Updates Music's separate lyrics field. */
  onLyricsChange: (lyrics: string) => void
  /** Switches output media family. */
  onModeChange: (mode: CreateMode) => void
  /** Selects one compatible model from the existing catalog. */
  onModelChange: (model: GenerationModelDefinition) => void
  /** Persists only the narrow PromptTemplate value. */
  onPromptChange: (prompt: PromptTemplate) => void
  /** Removes an attachment and rewrites affected prompt indexes atomically. */
  onRemoveAttachment: (attachmentId: string) => void
  /** Reorders request inputs while retaining exact structured references. */
  onReorderAttachments: (attachmentIds: string[]) => void
  /** Updates one provider-neutral catalog setting. */
  onSettingChange: (settingId: string, value: GenerationSettingValue) => void
}) {
  const { t } = useTranslation()
  const promptVisible = acceptsPrompt(draft)

  return (
    <form
      aria-label={t('create.composer.label')}
      className="
        overflow-hidden rounded-[1.375rem] border border-border/80 bg-card/95
        shadow-[0_24px_80px_rgb(0_0_0/0.34)]
      "
      onKeyDownCapture={(event) => {
        if (
          event.key === 'Enter'
          && (event.metaKey || event.ctrlKey)
          && !disabled
          && !blockingReason
        ) {
          event.preventDefault()
          onGenerate()
        }
      }}
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled && !blockingReason)
          onGenerate()
      }}
    >
      <div className="
        flex min-w-0 items-center gap-2 px-3 pt-3
        sm:px-4
      "
      >
        <Tabs
          className="min-w-0"
          value={draft.mode}
          onValueChange={value => onModeChange(value as CreateMode)}
        >
          <TabsList className="h-8 max-w-full bg-muted/55 p-0.5">
            <TabsTrigger className="h-7 px-2.5" value="image">
              <IconPhoto />
              <span className="
                hidden
                sm:inline
              "
              >
                {t('create.modes.image')}
              </span>
            </TabsTrigger>
            <TabsTrigger className="h-7 px-2.5" value="video">
              <IconVideo />
              <span className="
                hidden
                sm:inline
              "
              >
                {t('create.modes.video')}
              </span>
            </TabsTrigger>
            <TabsTrigger className="h-7 px-2.5" value="audio">
              <IconWaveSine />
              <span className="
                hidden
                sm:inline
              "
              >
                {t('create.modes.audio')}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {draft.mode === 'audio' && (
        <div className="
          no-scrollbar overflow-x-auto px-3 pt-2
          sm:px-4
        "
        >
          <ToggleGroup
            aria-label={t('create.audioIntents.label')}
            className="w-max"
            size="sm"
            value={[draft.audioIntent]}
            variant="filled"
            onValueChange={(values) => {
              const next = values.at(-1)
              if (CREATE_AUDIO_INTENTS.includes(next as CreateDraft['audioIntent']))
                onAudioIntentChange(next as CreateDraft['audioIntent'])
            }}
          >
            {CREATE_AUDIO_INTENTS.map(intent => (
              <ToggleGroupItem key={intent} value={intent}>
                {t(`create.audioIntents.${intent}` as 'create.audioIntents.speechGeneration')}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
      <div className="
        flex min-w-0 flex-col gap-2 p-3
        sm:px-4
      "
      >
        <CreateAttachments
          draft={draft}
          resolution={resolution}
          onAdd={onAddAttachment}
          onRemove={onRemoveAttachment}
          onReorder={onReorderAttachments}
        />
        {promptVisible && (
          <div className="min-w-0">
            <Label className="sr-only" htmlFor="create-prompt">
              {t(promptLabelKey(draft))}
            </Label>
            <PromptComposer
              key={createNodeType(draft.mode, draft.audioIntent)}
              className="
                max-h-32 min-h-5 rounded-none border-0 bg-transparent p-0
                text-sm/relaxed
                focus-within:border-transparent focus-within:bg-transparent
                hover:bg-transparent
              "
              disabled={disabled}
              id="create-prompt"
              inputs={resolution.promptInputs}
              label={t(promptLabelKey(draft))}
              placeholder={t(promptPlaceholderKey(draft))}
              template={draft.prompt}
              onChange={onPromptChange}
            />
          </div>
        )}
      </div>
      {draft.mode === 'audio' && draft.audioIntent === 'musicGeneration' && (
        <div className="
          px-3 pb-3
          sm:px-4
        "
        >
          <Label className="sr-only" htmlFor="create-lyrics">
            {t('create.composer.lyricsLabel')}
          </Label>
          <Textarea
            className="min-h-14 bg-muted/35 text-sm"
            id="create-lyrics"
            maxLength={16_000}
            placeholder={t('create.composer.lyricsPlaceholder')}
            value={draft.lyrics}
            onChange={event => onLyricsChange(event.currentTarget.value)}
          />
        </div>
      )}
      <div className="
        flex flex-wrap items-center gap-1.5 border-t border-border/65 px-3
        py-2.5
        sm:px-4
      "
      >
        <div className="max-w-56 min-w-32 flex-1">
          <CreateModelPicker
            draft={draft}
            generationConfig={generationConfig}
            resolution={resolution}
            onModelChange={onModelChange}
          />
        </div>
        {resolution.activeSettings.length > 0 && (
          <Popover>
            <PopoverTrigger
              render={(
                <Button
                  aria-label={t('create.settings.output')}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              )}
            >
              <IconAdjustmentsHorizontal />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="
                max-h-[min(32rem,70svh)] w-[min(22rem,calc(100vw-2rem))]
                overflow-y-auto
              "
              side="top"
            >
              <PopoverHeader>
                <PopoverTitle className="text-sm">
                  {t('create.settings.output')}
                </PopoverTitle>
              </PopoverHeader>
              <GenerationSettingsList
                layout="standalone"
                settings={resolution.activeSettings}
                values={draft.settings}
                onValueChange={onSettingChange}
              />
            </PopoverContent>
          </Popover>
        )}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {canUseDebugMode && (
            <div className="flex shrink-0 items-center gap-1.5">
              <IconBug className="size-3.5 text-muted-foreground" />
              <Switch
                aria-label={t('flows.debugMode.active')}
                checked={debugMode}
                size="sm"
                onCheckedChange={onDebugModeChange}
              />
            </div>
          )}
          {debugMode
            ? null
            : <GenerationRunCostEstimate state={estimateState} />}
          <Button
            className="
              h-10 rounded-xl px-4
              disabled:pointer-events-auto disabled:cursor-not-allowed
              sm:px-5
            "
            disabled={disabled || Boolean(blockingReason)}
            type="submit"
          >
            <IconSparkles />
            {t('create.commands.generate')}
          </Button>
        </div>
      </div>
    </form>
  )
}
