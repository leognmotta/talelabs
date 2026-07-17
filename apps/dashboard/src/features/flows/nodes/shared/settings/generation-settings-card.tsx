/** Common settings-card shell with readiness and catalog-version feedback. */

import type { ComponentType, ReactNode } from 'react'
import type { ModelPickerOption } from '../../../../generation/model-picker'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { IconRefresh } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import { ModelPicker } from '../../../../generation/model-picker'

/** Provides common model controls, readiness feedback, and active setting sections. */
export function GenerationSettingsCard({
  ariaLabel,
  children,
  emptyMessage,
  icon: Icon,
  modelAriaLabel,
  modelOptions,
  recommendedLabel,
  searchAriaLabel,
  searchPlaceholder,
  selectedModelLabel,
  showModelPicker = true,
  title,
  unavailableLabel,
  upgradeLabel,
  value,
  onModelChange,
  onUpgrade,
}: {
  ariaLabel: string
  children?: ReactNode
  emptyMessage: string
  icon: ComponentType<{ className?: string }>
  modelAriaLabel: string
  modelOptions: ModelPickerOption[]
  onModelChange: (value: string) => void
  onUpgrade?: () => void
  recommendedLabel: string
  searchAriaLabel: string
  searchPlaceholder: string
  selectedModelLabel: string
  showModelPicker?: boolean
  title: string
  unavailableLabel: string
  upgradeLabel: string
  value: string
}) {
  return (
    <aside aria-label={ariaLabel} className="nopan nowheel">
      <Card className="w-80" size="sm">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Icon aria-hidden className="size-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {showModelPicker && (
            <ModelPicker
              ariaLabel={modelAriaLabel}
              emptyMessage={emptyMessage}
              options={modelOptions}
              recommendedLabel={recommendedLabel}
              searchAriaLabel={searchAriaLabel}
              searchPlaceholder={searchPlaceholder}
              selectedLabel={selectedModelLabel}
              unavailableLabel={unavailableLabel}
              value={value}
              onValueChange={onModelChange}
            />
          )}
          {onUpgrade && (
            <Button
              className="self-start"
              size="xs"
              title={upgradeLabel}
              type="button"
              variant="secondary"
              onClick={onUpgrade}
            >
              <IconRefresh data-icon="inline-start" />
              {upgradeLabel}
            </Button>
          )}
          {children}
        </CardContent>
      </Card>
    </aside>
  )
}
