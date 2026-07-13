import { Button } from '@talelabs/ui/components/button'
import { cn } from '@talelabs/ui/lib/utils'
import { SearchablePicker } from '../../shared/components/searchable-picker'
import { ProviderLogo } from './provider-logo'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

export interface ModelPickerOption {
  category: {
    id: string
    label: string
  }
  id: string
  label: string
  disabled?: boolean
  provider: {
    id: string
    logoUrl?: string
    name: string
  }
  status?: string
}

export function ModelPicker({
  ariaLabel,
  emptyMessage,
  options,
  searchAriaLabel,
  searchPlaceholder,
  showProviderLogo = true,
  triggerClassName,
  value,
  onValueChange,
}: {
  ariaLabel: string
  emptyMessage: string
  options: ModelPickerOption[]
  searchAriaLabel: string
  searchPlaceholder: string
  showProviderLogo?: boolean
  triggerClassName?: string
  value: string
  onValueChange: (value: string) => void
}) {
  const selectedOption = options.find(option => option.id === value) ?? null
  const groupedOptions = new Map<string, ModelPickerOption[]>()
  for (const option of options) {
    const group = groupedOptions.get(option.category.id) ?? []
    group.push(option)
    groupedOptions.set(option.category.id, group)
  }
  const groups = [...groupedOptions.entries()].map(([categoryId, items]) => ({
    id: categoryId,
    items: items.map(option => ({
      content: (
        <>
          <ProviderLogo
            logoUrl={option.provider.logoUrl}
            name={option.provider.name}
            providerId={option.provider.id}
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{option.label}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {option.status ?? option.provider.name}
            </span>
          </span>
        </>
      ),
      disabled: option.disabled,
      id: option.id,
      searchValue: [
        option.label,
        option.provider.name,
        option.category.label,
      ].join(' '),
    })),
    label: items[0]?.category.label ?? categoryId,
  }))

  return (
    <SearchablePicker
      ariaLabel={ariaLabel}
      emptyMessage={emptyMessage}
      groups={groups}
      searchAriaLabel={searchAriaLabel}
      searchPlaceholder={searchPlaceholder}
      selectedId={value}
      showGroupLabels={groups.length > 1}
      trigger={(
        <Button
          aria-label={ariaLabel}
          className={cn(`
            nodrag nopan h-8 w-full min-w-0 justify-start gap-2 rounded-md
            border-border/70 bg-muted/25 px-2.5 text-xs font-normal
            hover:bg-muted/35
          `, triggerClassName)}
          size="sm"
          variant="outline"
        />
      )}
      triggerContent={(
        <>
          {selectedOption && showProviderLogo && (
            <ProviderLogo
              logoUrl={selectedOption.provider.logoUrl}
              name={selectedOption.provider.name}
              providerId={selectedOption.provider.id}
            />
          )}
          <span className="min-w-0 flex-1 truncate text-left">
            {selectedOption?.label}
          </span>
          {selectedOption?.status && (
            <span className="truncate text-[10px] text-muted-foreground">
              {selectedOption.status}
            </span>
          )}
        </>
      )}
      onSelect={onValueChange}
    />
  )
}
