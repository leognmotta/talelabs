import type { ReactElement, ReactNode } from 'react'

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from '@talelabs/ui/components/combobox'
import {
  ScrollOverflowAffordance,
  useScrollOverflowAffordance,
} from '@talelabs/ui/components/scroll-overflow-affordance'
import { cn } from '@talelabs/ui/lib/utils'
import { Fragment, useCallback, useLayoutEffect, useState } from 'react'

const COMBOBOX_OPTION_SELECTOR = '[role="option"]'

export interface SearchablePickerItem {
  content: ReactNode
  disabled?: boolean
  id: string
  searchValue: string
}

export interface SearchablePickerGroup {
  id: string
  items: SearchablePickerItem[]
  label: string
  separatorBefore?: boolean
}

export function SearchablePicker({
  align = 'start',
  ariaLabel,
  contentClassName,
  emptyMessage,
  groups,
  searchAriaLabel,
  searchPlaceholder,
  selectedId,
  showGroupLabels = true,
  showOverflowAffordance = false,
  showTriggerChevron = true,
  side = 'bottom',
  sideOffset = 6,
  trigger,
  triggerContent,
  onSelect,
}: {
  align?: 'center' | 'end' | 'start'
  ariaLabel: string
  contentClassName?: string
  emptyMessage: string
  groups: SearchablePickerGroup[]
  searchAriaLabel: string
  searchPlaceholder: string
  selectedId?: string
  showGroupLabels?: boolean
  showOverflowAffordance?: boolean
  showTriggerChevron?: boolean
  side?: 'bottom' | 'left' | 'right' | 'top'
  sideOffset?: number
  trigger: ReactElement
  triggerContent: ReactNode
  onSelect: (id: string) => void
}) {
  const [listElement, setListElement] = useState<HTMLDivElement | null>(null)
  const {
    hasMoreAfter,
    scheduleOverflowUpdate,
    updateOverflowState,
  } = useScrollOverflowAffordance({
    enabled: showOverflowAffordance,
    endItemSelector: COMBOBOX_OPTION_SELECTOR,
    scrollElement: listElement,
  })
  const selectedItem = groups
    .flatMap(group => group.items)
    .find(item => item.id === selectedId) ?? null

  const handleItemHighlighted = useCallback(() => {
    scheduleOverflowUpdate()
  }, [scheduleOverflowUpdate])

  useLayoutEffect(() => {
    scheduleOverflowUpdate()
  }, [groups, scheduleOverflowUpdate])

  return (
    <Combobox
      autoHighlight
      filter={(item, query) => item.searchValue
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase())}
      isItemEqualToValue={(item, selected) => item.id === selected.id}
      itemToStringLabel={item => item.searchValue}
      itemToStringValue={item => item.id}
      items={groups}
      value={selectedItem}
      onItemHighlighted={showOverflowAffordance
        ? handleItemHighlighted
        : undefined}
      onValueChange={(item) => {
        if (item)
          onSelect(item.id)
      }}
    >
      <ComboboxTrigger render={trigger} showChevron={showTriggerChevron}>
        {triggerContent}
      </ComboboxTrigger>
      <ComboboxContent
        aria-label={ariaLabel}
        className={cn(
          `
            w-[min(22rem,calc(100vw-2rem))] min-w-0 rounded-2xl border
            border-border/90 shadow-2xl
            *:data-[slot=input-group]:m-2 *:data-[slot=input-group]:mb-0
            *:data-[slot=input-group]:h-10 *:data-[slot=input-group]:border-0
            *:data-[slot=input-group]:bg-transparent
            *:data-[slot=input-group]:shadow-none
          `,
          contentClassName,
        )}
        align={align}
        side={side}
        sideOffset={sideOffset}
      >
        <ComboboxInput
          aria-label={searchAriaLabel}
          placeholder={searchPlaceholder}
          showTrigger={false}
        />
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <div className="relative mt-1 overflow-hidden">
          <ComboboxList
            className="max-h-96 p-2"
            ref={setListElement}
            onScroll={updateOverflowState}
          >
            {(group: SearchablePickerGroup) => (
              <Fragment key={group.id}>
                {group.separatorBefore && <ComboboxSeparator />}
                <ComboboxGroup items={group.items}>
                  {showGroupLabels && <ComboboxLabel>{group.label}</ComboboxLabel>}
                  <ComboboxCollection>
                    {(item: SearchablePickerItem) => (
                      <ComboboxItem
                        className="min-h-14 gap-3 rounded-xl px-3 py-2"
                        disabled={item.disabled}
                        key={item.id}
                        value={item}
                      >
                        {item.content}
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxGroup>
              </Fragment>
            )}
          </ComboboxList>
          {showOverflowAffordance && hasMoreAfter && (
            <ScrollOverflowAffordance />
          )}
        </div>
      </ComboboxContent>
    </Combobox>
  )
}
