import type { GenerationModelDefinition } from '@talelabs/flows'

import { Field, FieldLabel } from '@talelabs/ui/components/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@talelabs/ui/components/select'
import { useTranslation } from 'react-i18next'

export function GenerationOperationField({
  model,
  operationId,
  onOperationChange,
}: {
  model: GenerationModelDefinition
  onOperationChange: (operationId: string) => void
  operationId: string
}) {
  const { t } = useTranslation()

  return (
    <Field className="min-h-8" orientation="horizontal">
      <FieldLabel className="text-xs font-normal text-muted-foreground">
        {t('flows.operation')}
      </FieldLabel>
      <Select
        value={operationId}
        onValueChange={(value) => {
          if (value !== null)
            onOperationChange(value)
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
            {model.operations.map(operation => (
              <SelectItem key={operation.id} value={operation.id}>
                {t(operation.labelKey)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
