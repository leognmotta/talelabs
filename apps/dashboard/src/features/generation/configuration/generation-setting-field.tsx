/** Dispatches one catalog setting definition to its matching typed control. */

import type {
  GenerationSettingDefinition,
  GenerationSettingValue,
} from '@talelabs/flows'

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
import { useTranslation } from 'react-i18next'
import { GenerationNumberSettingInput } from './generation-number-setting-input'

/** Selects the boolean, enum, number, or text control declared by catalog metadata. */
export function GenerationSettingField({
  onValueChange,
  setting,
  value,
}: {
  onValueChange: (value: GenerationSettingValue) => void
  setting: GenerationSettingDefinition
  value: GenerationSettingValue
}) {
  const { t } = useTranslation()
  const label = t(setting.labelKey)

  if (setting.kind === 'boolean') {
    return (
      <Field className="min-h-8" orientation="horizontal">
        <FieldLabel className="text-xs font-normal text-muted-foreground">
          {label}
        </FieldLabel>
        <Switch
          aria-label={label}
          checked={Boolean(value)}
          size="sm"
          onCheckedChange={onValueChange}
        />
      </Field>
    )
  }

  if (setting.kind === 'enum') {
    const offOption = setting.options.find(option => option.value === 'off')
    const onOption = setting.options.find(option => option.value !== 'off')
    const isBinaryToggle = setting.options.length === 2 && offOption && onOption

    if (isBinaryToggle) {
      return (
        <Field className="min-h-8" orientation="horizontal">
          <FieldLabel className="text-xs font-normal text-muted-foreground">
            {label}
          </FieldLabel>
          <Switch
            aria-label={label}
            checked={String(value) === onOption.value}
            size="sm"
            onCheckedChange={checked => onValueChange(
              checked ? onOption.value : offOption.value,
            )}
          />
        </Field>
      )
    }

    return (
      <Field className="min-h-8" orientation="horizontal">
        <FieldLabel className="text-xs font-normal text-muted-foreground">
          {label}
        </FieldLabel>
        <Select
          value={String(value)}
          onValueChange={(nextValue) => {
            if (nextValue !== null)
              onValueChange(nextValue)
          }}
        >
          <SelectTrigger
            aria-label={label}
            className="min-w-28 border-border/70 bg-muted/25 text-xs"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="end"
            alignItemWithTrigger={false}
            sideOffset={6}
          >
            <SelectGroup>
              {setting.options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {setting.id === 'aspectRatio' && option.value !== 'auto'
                    ? option.value
                    : t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    )
  }

  return (
    <Field className="min-h-8" orientation="horizontal">
      <FieldLabel className="text-xs font-normal text-muted-foreground">
        {label}
      </FieldLabel>
      {setting.kind === 'number'
        ? (
            <GenerationNumberSettingInput
              ariaLabel={label}
              key={`${setting.id}:${value}`}
              setting={setting}
              value={Number(value)}
              onValueChange={onValueChange}
            />
          )
        : (
            <Input
              aria-label={label}
              className="h-8 w-28 text-xs"
              maxLength={setting.maxLength}
              type="text"
              value={String(value)}
              onChange={event => onValueChange(event.currentTarget.value)}
            />
          )}
    </Field>
  )
}
