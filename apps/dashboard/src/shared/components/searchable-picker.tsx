/** Shared searchable picker composition for grouped dashboard option lists. */

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

/** One selectable option in a searchable picker group. */
export interface SearchablePickerItem {
  /** Rich option content rendered inside the combobox item. */
  content: ReactNode
  /** Whether the option is visible but unavailable for selection. */
  disabled?: boolean
  /** Stable value returned when the option is selected. */
  id: string
  /** Localized plain text matched by the combobox search. */
  searchValue: string
}

/** One ordered, labelled section of searchable picker options. */
export interface SearchablePickerGroup {
  /** Stable identity for the option section. */
  id: string
  /** Options rendered in the section's canonical order. */
  items: SearchablePickerItem[]
  /** Localized section label shown above its options. */
  label: string
  /** Whether a visual divider precedes this section. */
  separatorBefore?: boolean
}

/** Renders a searchable, grouped combobox with optional picker-specific controls. */
export function SearchablePicker({
  align = 'start',
  ariaLabel,
  contentClassName,
  controls,
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
  controls?: ReactNode
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
        if (item && item.id !== selectedId)
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
            *:data-[slot=input-group]:h-10
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
          variant="outline"
        />
        {controls}
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
