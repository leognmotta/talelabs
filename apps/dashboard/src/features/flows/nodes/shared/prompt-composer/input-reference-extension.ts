/** Atomic prompt-reference node and local selected-input suggestion behavior. */

import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import type { RefAttributes } from 'react'
import type {
  InputReferenceMenuHandle,
  InputReferenceMenuProps,
} from './input-reference-menu'
import type {
  PromptComposerSuggestion,
  PromptComposerSuggestionCopy,
} from './prompt-composer-types'

import { mergeAttributes, Node } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, {
  exitSuggestion,
  SuggestionPluginKey,
} from '@tiptap/suggestion'
import { InputReferenceMenu } from './input-reference-menu'
import { INPUT_REFERENCE_NODE_NAME } from './prompt-template-adapter'

type InputReferenceMenuRendererProps
  = Omit<InputReferenceMenuProps, 'ref'> & RefAttributes<InputReferenceMenuHandle>

function suggestionMenu(input: {
  getCopy: () => PromptComposerSuggestionCopy
}) {
  let component: null | ReactRenderer<
    InputReferenceMenuHandle,
    InputReferenceMenuRendererProps
  > = null
  let unmount: (() => void) | null = null

  function menuProps(props: SuggestionProps<PromptComposerSuggestion>) {
    return {
      copy: input.getCopy(),
      items: props.items,
      onSelect: props.command,
    }
  }

  return {
    onExit() {
      unmount?.()
      component?.destroy()
      unmount = null
      component = null
    },
    onKeyDown({ event, view }: SuggestionKeyDownProps) {
      if (event.key === 'Escape') {
        exitSuggestion(view, SuggestionPluginKey)
        return true
      }
      return component?.ref?.onKeyDown(event) ?? false
    },
    onStart(props: SuggestionProps<PromptComposerSuggestion>) {
      const nextComponent = new ReactRenderer(InputReferenceMenu, {
        editor: props.editor,
        props: menuProps(props),
      })
      component = nextComponent
      unmount = props.mount(nextComponent.element)
    },
    onUpdate(props: SuggestionProps<PromptComposerSuggestion>) {
      component?.updateProps(menuProps(props))
    },
  }
}

/** Creates the custom inline atom and its `@` suggestion plugin. */
export function createInputReferenceExtension(input: {
  getCopy: () => PromptComposerSuggestionCopy
  getInputs: () => readonly PromptComposerSuggestion[]
  onSelectStart: () => void
}) {
  return Node.create({
    addAttributes() {
      return {
        displayLabel: { default: '', rendered: false },
        index: {
          default: 0,
          parseHTML: element => Number(element.getAttribute('data-index') ?? 0),
          rendered: false,
        },
        inputName: { default: '', rendered: false },
        invalid: { default: false, rendered: false },
        mediaType: {
          default: 'image',
          parseHTML: element => element.getAttribute('data-media-type') ?? 'image',
          rendered: false,
        },
        slotId: {
          default: '',
          parseHTML: element => element.getAttribute('data-slot-id') ?? '',
          rendered: false,
        },
        tooltip: { default: '', rendered: false },
      }
    },
    addProseMirrorPlugins() {
      return [Suggestion<PromptComposerSuggestion>({
        char: '@',
        command: ({ editor, props, range }) => {
          input.onSelectStart()
          editor.chain().focus().insertContentAt(range, [
            {
              attrs: {
                displayLabel: `@${props.displayLabel}`,
                index: props.index,
                inputName: props.name,
                invalid: false,
                mediaType: props.mediaType,
                slotId: props.slotId,
                tooltip: `@${props.displayLabel} · ${props.name}`,
              },
              type: this.name,
            },
            { text: ' ', type: 'text' },
          ]).run()
        },
        editor: this.editor,
        items: ({ query }) => {
          const normalizedQuery = query.trim().toLocaleLowerCase()
          return input.getInputs().filter(item => (
            !normalizedQuery
            || item.displayLabel.toLocaleLowerCase().includes(normalizedQuery)
            || item.name.toLocaleLowerCase().includes(normalizedQuery)
          ))
        },
        pluginKey: SuggestionPluginKey,
        render: () => suggestionMenu({ getCopy: input.getCopy }),
      })]
    },
    atom: true,
    draggable: false,
    group: 'inline',
    inline: true,
    name: INPUT_REFERENCE_NODE_NAME,
    parseHTML() {
      return [{ tag: 'span[data-prompt-input-reference]' }]
    },
    renderHTML({ node }) {
      return [
        'span',
        mergeAttributes({
          'class': node.attrs.invalid
            ? 'nodrag nopan nowheel inline-flex cursor-text rounded-md border border-destructive/60 bg-destructive/10 px-1.5 py-0.5 align-baseline font-medium text-destructive'
            : 'nodrag nopan nowheel inline-flex cursor-text rounded-md border border-border/70 bg-muted px-1.5 py-0.5 align-baseline font-medium text-foreground',
          'contenteditable': 'false',
          'data-index': String(node.attrs.index),
          'data-media-type': node.attrs.mediaType,
          'data-prompt-input-reference': '',
          'data-slot-id': node.attrs.slotId,
          'title': node.attrs.tooltip,
        }),
        node.attrs.displayLabel,
      ]
    },
    selectable: false,
  })
}
