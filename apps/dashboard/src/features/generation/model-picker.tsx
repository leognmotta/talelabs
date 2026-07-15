import type { GenerationModelLogoId } from '@talelabs/flows'

import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { cn } from '@talelabs/ui/lib/utils'
import { useMemo } from 'react'
import { SearchablePicker } from '../../shared/components/searchable-picker'
import { ModelLogo } from './model-logo'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

export interface ModelPickerOption {
  capabilities: string[]
  category: {
    id: string
    label: string
  }
  description: string
  id: string
  label: string
  logoId: GenerationModelLogoId
  recommended: boolean
}

export function ModelPicker({
  ariaLabel,
  emptyMessage,
  options,
  recommendedLabel,
  searchAriaLabel,
  searchPlaceholder,
  selectedLabel,
  showLogos = true,
  triggerClassName,
  value,
  onValueChange,
}: {
  ariaLabel: string
  emptyMessage: string
  options: ModelPickerOption[]
  recommendedLabel: string
  searchAriaLabel: string
  searchPlaceholder: string
  selectedLabel?: string
  showLogos?: boolean
  triggerClassName?: string
  value: string
  onValueChange: (value: string) => void
}) {
  const selectedOption = useMemo(
    () => options.find(option => option.id === value) ?? null,
    [options, value],
  )
  const triggerLabel = selectedOption?.label ?? selectedLabel
  const groups = useMemo(() => {
    const groupedOptions = new Map<string, ModelPickerOption[]>()
    for (const option of options) {
      const group = groupedOptions.get(option.category.id) ?? []
      group.push(option)
      groupedOptions.set(option.category.id, group)
    }
    return [...groupedOptions.entries()].map(([categoryId, items]) => ({
      id: categoryId,
      items: items.map(option => ({
        content: (
          <div className="flex min-w-0 flex-1 items-start gap-3 py-0.5">
            {showLogos && <ModelLogo logoId={option.logoId} />}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{option.label}</span>
                {option.recommended && (
                  <Badge
                    className="h-4 px-1.5 text-[10px] font-medium"
                    variant="secondary"
                  >
                    {recommendedLabel}
                  </Badge>
                )}
              </div>
              <p className="
                mt-0.5 line-clamp-2 text-xs font-normal text-muted-foreground
              "
              >
                {option.description}
              </p>
              {option.capabilities.length > 0 && (
                <p className="
                  mt-1 truncate text-[11px] font-normal text-muted-foreground/75
                "
                >
                  {option.capabilities.slice(0, 3).join(' · ')}
                </p>
              )}
            </div>
          </div>
        ),
        id: option.id,
        searchValue: [
          option.label,
          option.category.label,
          option.description,
          ...option.capabilities,
        ].join(' '),
      })),
      label: items[0]?.category.label ?? categoryId,
    }))
  }, [options, recommendedLabel, showLogos])

  return (
    <SearchablePicker
      ariaLabel={ariaLabel}
      emptyMessage={emptyMessage}
      contentClassName="w-[min(28rem,calc(100vw-2rem))]"
      groups={groups}
      searchAriaLabel={searchAriaLabel}
      searchPlaceholder={searchPlaceholder}
      selectedId={value}
      showGroupLabels={groups.length > 1}
      trigger={(
        <Button
          aria-label={ariaLabel}
          className={cn(
            `
              nodrag nopan h-9 w-full min-w-0 justify-start gap-2 rounded-md
              border-border/70 bg-muted/25 px-2.5 text-xs font-normal
              hover:bg-muted/35
            `,
            triggerClassName,
          )}
          size="sm"
          variant="outline"
        />
      )}
      triggerContent={(
        <>
          {showLogos && selectedOption && (
            <ModelLogo
              className="
                size-6 rounded-md
                [&_img]:size-3.5
              "
              logoId={selectedOption.logoId}
            />
          )}
          <span className="min-w-0 flex-1 truncate text-left">
            {triggerLabel}
          </span>
        </>
      )}
      onSelect={onValueChange}
    />
  )
}
