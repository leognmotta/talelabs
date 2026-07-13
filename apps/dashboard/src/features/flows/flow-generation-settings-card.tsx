import type { GenerationSettingDefinition } from '@talelabs/flows'
import type { CanvasNode } from './flow-canvas-types'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { IconAspectRatio, IconRefresh } from '@tabler/icons-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@talelabs/ui/components/alert-dialog'
import { Button } from '@talelabs/ui/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import { Field, FieldLabel } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@talelabs/ui/components/select'
import { Switch } from '@talelabs/ui/components/switch'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ModelPicker } from '../generation/model-picker'
import { FLOW_DASHBOARD_NODE_REGISTRY } from './flow-dashboard-node-registry'
import { useFlowGenerationSettings } from './use-flow-generation-settings'

type NumberSetting = Extract<GenerationSettingDefinition, { kind: 'number' }>

function decimalPlaces(value: number) {
  const [coefficient, exponentText] = value.toString().toLowerCase().split('e')
  const exponent = Number(exponentText ?? 0)
  const fractionLength = coefficient?.split('.')[1]?.length ?? 0
  return Math.max(0, fractionLength - exponent)
}

function normalizeNumberSetting(value: number, setting: NumberSetting) {
  const clamped = Math.min(setting.max, Math.max(setting.min, value))
  const steps = Math.round((clamped - setting.min) / setting.step)
  const aligned = setting.min + steps * setting.step
  const precision = Math.min(12, Math.max(
    decimalPlaces(setting.min),
    decimalPlaces(setting.max),
    decimalPlaces(setting.step),
  ))
  return Number(aligned.toFixed(precision))
}

function NumberSettingInput({
  ariaLabel,
  onValueChange,
  setting,
  value,
}: {
  ariaLabel: string
  onValueChange: (value: number) => void
  setting: NumberSetting
  value: number
}) {
  const [draft, setDraft] = useState(String(value))

  function commit() {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const normalized = normalizeNumberSetting(parsed, setting)
    setDraft(String(normalized))
    if (normalized !== value)
      onValueChange(normalized)
  }

  return (
    <Input
      aria-label={ariaLabel}
      className="h-8 w-28 text-xs"
      max={setting.max}
      min={setting.min}
      step={setting.step}
      type="number"
      value={draft}
      onBlur={commit}
      onChange={event => setDraft(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter')
          event.currentTarget.blur()
        if (event.key === 'Escape')
          setDraft(String(value))
      }}
    />
  )
}

export function FlowGenerationSettingsCard({ node }: { node: CanvasNode }) {
  const { t } = useTranslation()
  const {
    activeSettings,
    canUpgradeModelContract,
    cancelConfigurationChange,
    confirmConfigurationChange,
    incompatibleConnectionCount,
    model,
    modelOptions,
    operation,
    pendingChange,
    pendingModel,
    updateModel,
    updateOperation,
    updateSetting,
    upgradeModelContract,
  }
    = useFlowGenerationSettings(node)

  if (!model)
    return null

  const definition = FLOW_DASHBOARD_NODE_REGISTRY[node.type]
  const Icon = definition.icon

  return (
    <>
      <aside
        aria-label={t('flows.settings.label')}
        className="nopan nowheel"
      >
        <Card className="w-80" size="sm">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              {Icon && <Icon aria-hidden className="size-4" />}
              {t(definition.labelKey)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ModelPicker
              ariaLabel={t('flows.model')}
              emptyMessage={t('flows.modelPicker.noResults')}
              options={modelOptions}
              searchAriaLabel={t('flows.modelPicker.searchLabel')}
              searchPlaceholder={t('flows.modelPicker.searchPlaceholder')}
              value={model.id}
              onValueChange={updateModel}
            />
            {canUpgradeModelContract && (
              <Button
                className="self-start"
                size="xs"
                type="button"
                variant="secondary"
                onClick={upgradeModelContract}
              >
                <IconRefresh data-icon="inline-start" />
                {t('flows.modelChange.update')}
              </Button>
            )}

            {model.operations.length > 1 && operation && (
              <Field className="min-h-8" orientation="horizontal">
                <FieldLabel className="
                  text-xs font-normal text-muted-foreground
                "
                >
                  {t('flows.operation')}
                </FieldLabel>
                <Select
                  value={operation.id}
                  onValueChange={(value) => {
                    if (value !== null)
                      updateOperation(value)
                  }}
                >
                  <SelectTrigger
                    aria-label={t('flows.operation')}
                    className="min-w-40 border-border/70 bg-muted/25 text-xs"
                    size="sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" alignItemWithTrigger={false} sideOffset={6}>
                    <SelectGroup>
                      {model.operations.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {t(item.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}

            {activeSettings.length > 0 && (
              <div className="
                flex flex-col gap-3 border-t border-border/70 pt-4
              "
              >
                {activeSettings.map((setting) => {
                  const value = node.data.settings?.[setting.id] ?? setting.default
                  if (setting.kind === 'boolean') {
                    return (
                      <Field
                        className="min-h-8"
                        key={setting.id}
                        orientation="horizontal"
                      >
                        <FieldLabel className="
                          text-xs font-normal text-muted-foreground
                        "
                        >
                          {t(setting.labelKey)}
                        </FieldLabel>
                        <Switch
                          checked={Boolean(value)}
                          size="sm"
                          onCheckedChange={checked => updateSetting(setting.id, checked)}
                        />
                      </Field>
                    )
                  }

                  if (setting.kind === 'string') {
                    return (
                      <Field
                        className="min-h-8"
                        key={setting.id}
                        orientation="horizontal"
                      >
                        <FieldLabel className="
                          text-xs font-normal text-muted-foreground
                        "
                        >
                          {t(setting.labelKey)}
                        </FieldLabel>
                        <Input
                          aria-label={t(setting.labelKey)}
                          className="h-8 min-w-0 text-xs"
                          maxLength={setting.maxLength}
                          value={String(value)}
                          onChange={event => updateSetting(setting.id, event.target.value)}
                        />
                      </Field>
                    )
                  }

                  if (setting.kind === 'number') {
                    return (
                      <Field
                        className="min-h-8"
                        key={setting.id}
                        orientation="horizontal"
                      >
                        <FieldLabel className="
                          text-xs font-normal text-muted-foreground
                        "
                        >
                          {t(setting.labelKey)}
                        </FieldLabel>
                        <NumberSettingInput
                          ariaLabel={t(setting.labelKey)}
                          key={`${setting.id}:${value}`}
                          setting={setting}
                          value={Number(value)}
                          onValueChange={nextValue => updateSetting(
                            setting.id,
                            nextValue,
                          )}
                        />
                      </Field>
                    )
                  }

                  const options = setting.options

                  return (
                    <Field
                      className="min-h-8"
                      key={setting.id}
                      orientation="horizontal"
                    >
                      <FieldLabel className="
                        text-xs font-normal text-muted-foreground
                      "
                      >
                        {t(setting.labelKey)}
                      </FieldLabel>
                      <Select
                        value={String(value)}
                        onValueChange={(nextValue) => {
                          if (nextValue === null)
                            return
                          updateSetting(
                            setting.id,
                            nextValue,
                          )
                        }}
                      >
                        <SelectTrigger
                          aria-label={t(setting.labelKey)}
                          className="
                            min-w-28 border-border/70 bg-muted/25 text-xs
                          "
                          size="sm"
                        >
                          {setting.id === 'aspectRatio' && (
                            <IconAspectRatio aria-hidden data-icon="inline-start" />
                          )}
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          align="end"
                          alignItemWithTrigger={false}
                          sideOffset={6}
                        >
                          <SelectGroup>
                            {options.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {setting.id === 'aspectRatio'
                                  ? option.value
                                  : option.labelKey
                                    ? t(option.labelKey)
                                    : option.value}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </aside>
      <AlertDialog
        open={Boolean(pendingChange)}
        onOpenChange={open => !open && cancelConfigurationChange()}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(pendingChange?.kind === 'operation'
                ? 'flows.operationChange.title'
                : 'flows.modelChange.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(pendingChange?.kind === 'operation'
                ? 'flows.operationChange.description'
                : 'flows.modelChange.description', {
                count: incompatibleConnectionCount,
                model: pendingModel ? t(pendingModel.labelKey) : '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelConfigurationChange}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmConfigurationChange}>
              {t(pendingChange?.kind === 'operation'
                ? 'flows.operationChange.confirm'
                : 'flows.modelChange.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
