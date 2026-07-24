/** TaleLabs command-menu presentation for local prompt input suggestions. */

import type {
  KeyboardEvent as ReactKeyboardEvent,
  Ref,
} from 'react'
import type {
  PromptComposerSuggestion,
  PromptComposerSuggestionCopy,
} from './prompt-composer-types'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@talelabs/ui/components/command'
import { cn } from '@talelabs/ui/lib/utils'
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

const MEDIA_ORDER = ['image', 'video', 'audio'] as const

/** Keyboard surface invoked by Tiptap while editor focus remains active. */
export interface InputReferenceMenuHandle {
  /** Handles list navigation and selection without moving focus off the editor. */
  onKeyDown: (event: KeyboardEvent) => boolean
}

/** Props supplied by the Tiptap Suggestion renderer. */
export interface InputReferenceMenuProps {
  /** Localized menu and group copy. */
  copy: PromptComposerSuggestionCopy
  /** Current query-filtered selected inputs. */
  items: readonly PromptComposerSuggestion[]
  /** Optional surface event-isolation classes for a portaled suggestion menu. */
  interactionClassName?: string
  /** Inserts the chosen stable reference into the editor. */
  onSelect: (item: PromptComposerSuggestion) => void
  /** Imperative keyboard surface consumed by the focused Tiptap editor. */
  ref?: Ref<InputReferenceMenuHandle>
}

function itemValue(item: PromptComposerSuggestion): string {
  return `${item.slotId}:${item.index}`
}

/** Renders grouped selected inputs using the shared TaleLabs command primitives. */
export function InputReferenceMenu({
  copy,
  interactionClassName,
  items,
  ref,
  onSelect,
}: InputReferenceMenuProps) {
  const [selectedValue, setSelectedValue] = useState<null | string>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selectedIndex = Math.max(
    0,
    items.findIndex(item => itemValue(item) === selectedValue),
  )
  const selected = items[selectedIndex]
  const resolvedSelectedValue = selected ? itemValue(selected) : null

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [resolvedSelectedValue])

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (items.length === 0)
        return false
      if (event.key === 'ArrowDown') {
        setSelectedValue(itemValue(items[(selectedIndex + 1) % items.length]))
        return true
      }
      if (event.key === 'ArrowUp') {
        setSelectedValue(itemValue(
          items[(selectedIndex + items.length - 1) % items.length],
        ))
        return true
      }
      if (event.key === 'Enter') {
        onSelect(items[selectedIndex])
        return true
      }
      return false
    },
  }), [items, onSelect, selectedIndex])

  return (
    <Command
      className={cn(
        `
          relative z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border
          shadow-xl
        `,
        interactionClassName,
      )}
      data-prompt-input-menu=""
      shouldFilter={false}
      value={resolvedSelectedValue ?? undefined}
      onKeyDown={(event: ReactKeyboardEvent) => event.stopPropagation()}
      onMouseDown={event => event.preventDefault()}
      onPointerDownCapture={(event) => {
        if (event.button !== 0)
          return
        const option = event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-prompt-input-key]')
          : null
        const item = items.find(candidate => (
          itemValue(candidate) === option?.dataset.promptInputKey
        ))
        if (!item)
          return
        event.preventDefault()
        onSelect(item)
      }}
      onValueChange={(value) => {
        const index = items.findIndex(item => itemValue(item) === value)
        if (index >= 0)
          setSelectedValue(value)
      }}
    >
      <CommandList
        className="max-h-52 overscroll-contain"
        ref={listRef}
      >
        <CommandEmpty className="p-3 text-left text-xs text-muted-foreground">
          {copy.empty}
        </CommandEmpty>
        {MEDIA_ORDER.map((mediaType) => {
          const groupItems = items.filter(item => item.mediaType === mediaType)
          return groupItems.length > 0 && (
            <CommandGroup heading={copy.groups[mediaType]} key={mediaType}>
              {groupItems.map(item => (
                <CommandItem
                  className="rounded-lg px-2 py-1.5 text-xs"
                  data-prompt-input-key={itemValue(item)}
                  key={itemValue(item)}
                  value={itemValue(item)}
                  onSelect={() => onSelect(item)}
                >
                  <span className="
                    flex size-7 shrink-0 items-center justify-center
                    overflow-hidden rounded-md bg-muted text-[10px]
                    font-semibold text-muted-foreground uppercase
                  "
                  >
                    {item.previewUrl && item.mediaType === 'image'
                      ? <img alt="" className="size-full object-cover" src={item.previewUrl} />
                      : item.mediaType.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      @
                      {item.displayLabel}
                    </span>
                    <span className="
                      block truncate text-[10px] text-muted-foreground
                    "
                    >
                      {item.name}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )
        })}
      </CommandList>
    </Command>
  )
}
