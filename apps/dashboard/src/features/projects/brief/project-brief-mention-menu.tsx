/** Cursor-mounted command-menu presentation for Project Brief mentions. */

import type {
  ProjectMentionResolution,
  ProjectMentionType,
} from '@talelabs/sdk'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  Ref,
} from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@talelabs/ui/components/command'
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

const MENTION_TYPE_ORDER = [
  'asset',
  'flow',
  'session',
  'element',
  'folder',
] as const satisfies readonly ProjectMentionType[]

/** Localized presentation supplied to the non-React Tiptap renderer. */
export interface ProjectBriefMentionMenuCopy {
  /** Message shown when no Project item matches the current query. */
  empty: string
  /** Section labels keyed by supported Project entity family. */
  groups: Readonly<Record<ProjectMentionType, string>>
}

/** Keyboard surface invoked while editor focus remains active. */
export interface ProjectBriefMentionMenuHandle {
  /** Handles ArrowUp, ArrowDown, and Enter for the current result set. */
  onKeyDown: (event: KeyboardEvent) => boolean
}

/** Props supplied by the Tiptap Suggestion renderer. */
export interface ProjectBriefMentionMenuProps {
  /** Localized empty and group labels. */
  copy: ProjectBriefMentionMenuCopy
  /** Current query-filtered Project mention candidates. */
  items: readonly ProjectMentionResolution[]
  /** Inserts the selected stable entity identity into the document. */
  onSelect: (item: ProjectMentionResolution) => void
  /** Imperative keyboard surface consumed by the focused editor. */
  ref?: Ref<ProjectBriefMentionMenuHandle>
}

function itemValue(item: ProjectMentionResolution) {
  return `${item.entityType}:${item.entityId}`
}

/** Renders grouped Project entities through the shared command primitives. */
export function ProjectBriefMentionMenu({
  copy,
  items,
  ref,
  onSelect,
}: ProjectBriefMentionMenuProps) {
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
      className="
        relative z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border shadow-xl
      "
      shouldFilter={false}
      value={resolvedSelectedValue ?? undefined}
      onKeyDown={(event: ReactKeyboardEvent) => event.stopPropagation()}
      onMouseDown={event => event.preventDefault()}
      onPointerDownCapture={(event) => {
        if (event.button !== 0)
          return
        const option = event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-project-mention-key]')
          : null
        const item = items.find(candidate => (
          itemValue(candidate) === option?.dataset.projectMentionKey
        ))
        if (!item)
          return
        event.preventDefault()
        onSelect(item)
      }}
      onValueChange={(value) => {
        if (items.some(item => itemValue(item) === value))
          setSelectedValue(value)
      }}
    >
      <CommandList
        className="max-h-72 overscroll-contain"
        ref={listRef}
      >
        <CommandEmpty className="p-3 text-left text-xs text-muted-foreground">
          {copy.empty}
        </CommandEmpty>
        {MENTION_TYPE_ORDER.map((entityType) => {
          const groupItems = items.filter(
            item => item.entityType === entityType,
          )
          return groupItems.length > 0 && (
            <CommandGroup heading={copy.groups[entityType]} key={entityType}>
              {groupItems.map(item => (
                <CommandItem
                  className="rounded-lg px-2 py-1.5 text-xs"
                  data-project-mention-key={itemValue(item)}
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
                    {item.thumbnailUrl
                      ? (
                          <img
                            alt=""
                            className="size-full object-cover"
                            src={item.thumbnailUrl}
                          />
                        )
                      : entityType.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {item.label}
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
