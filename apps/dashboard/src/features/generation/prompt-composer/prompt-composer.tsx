/** Focus-lazy Tiptap composer for text plus stable media-input references. */

import type { PromptTemplate, PromptTemplateMediaType } from '@talelabs/flows'
import type { Editor, JSONContent } from '@tiptap/core'
import type { FocusEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { PromptComposerInput, PromptComposerSuggestionCopy } from './prompt-composer-types'

import { cn } from '@talelabs/ui/lib/utils'
import CharacterCount from '@tiptap/extension-character-count'
import Document from '@tiptap/extension-document'
import HardBreak from '@tiptap/extension-hard-break'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { UndoRedo } from '@tiptap/extensions/undo-redo'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createInputReferenceExtension } from './input-reference-extension'
import {
  promptTemplateFromEditorJson,
  promptTemplateIsValid,
  promptTemplateKey,
  promptTemplateToEditorJson,
  refreshPromptInputPresentations,
} from './prompt-template-adapter'

const MAX_PROMPT_CHARACTERS = 16_000

function promptPartSize(part: PromptTemplate['parts'][number]) {
  return part.type === 'text' ? part.text.length : 1
}

function promptContentSize(template: PromptTemplate) {
  return template.parts.reduce((size, part) => size + promptPartSize(part), 0)
}

function normalizedPlainText(text: string) {
  return text.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
}

function plainTextEditorContent(normalizedText: string): JSONContent[] {
  const content: JSONContent[] = []
  const lines = normalizedText.split('\n')
  for (const [index, line] of lines.entries()) {
    if (index > 0)
      content.push({ type: 'hardBreak' })
    if (line)
      content.push({ text: line, type: 'text' })
  }
  return content
}

function promptPositionAtPoint(input: {
  clientX: number
  clientY: number
  root: HTMLDivElement
  target: EventTarget | null
  template: PromptTemplate
}) {
  const fallback = input.clientX <= input.root.getBoundingClientRect().left
    ? 1
    : promptContentSize(input.template) + 1
  const targetElement = input.target instanceof Element ? input.target : null
  const chip = targetElement?.closest<HTMLElement>(
    '[data-prompt-input-reference]',
  )
  if (chip && input.root.contains(chip)) {
    const partIndex = Number(chip.dataset.promptPartIndex)
    if (Number.isInteger(partIndex) && input.template.parts[partIndex]) {
      const offset = input.template.parts
        .slice(0, partIndex)
        .reduce((size, part) => size + promptPartSize(part), 0)
      const bounds = chip.getBoundingClientRect()
      return offset + (input.clientX >= bounds.x + bounds.width / 2 ? 1 : 0) + 1
    }
  }

  const caretRange = document.caretRangeFromPoint?.(input.clientX, input.clientY)
  if (!caretRange || !input.root.contains(caretRange.startContainer))
    return fallback
  const beforeCaret = document.createRange()
  beforeCaret.selectNodeContents(input.root)
  beforeCaret.setEnd(caretRange.startContainer, caretRange.startOffset)
  const fragment = beforeCaret.cloneContents()
  let offset = fragment.textContent?.length ?? 0
  for (const reference of fragment.querySelectorAll(
    '[data-prompt-input-reference]',
  )) {
    offset -= Math.max(0, (reference.textContent?.length ?? 0) - 1)
  }
  return Math.min(promptContentSize(input.template), Math.max(0, offset)) + 1
}

function mediaReferenceLabel(
  t: ReturnType<typeof useTranslation>['t'],
  mediaType: PromptTemplateMediaType,
  index: number,
) {
  return t(`flows.promptComposer.references.${mediaType}`, { index: index + 1 })
}

/** Renders one lightweight read-only structured prompt without mounting Tiptap. */
export function PromptTemplatePreview({
  inputs,
  invalidTooltip,
  placeholder,
  template,
}: {
  inputs: readonly PromptComposerInput[]
  invalidTooltip: string
  placeholder: string
  template: PromptTemplate
}) {
  const { t } = useTranslation()
  const inputByKey = new Map(inputs.map(input => [
    `${input.slotId}\u0000${input.index}`,
    input,
  ]))
  if (template.parts.length === 0) {
    return <span className="text-muted-foreground/70">{placeholder}</span>
  }
  let keyPrefix = ''
  const keyedParts = template.parts.map((part, partIndex) => {
    keyPrefix += JSON.stringify(part)
    return { key: keyPrefix, part, partIndex }
  })
  return keyedParts.map(({ key, part, partIndex }) => {
    if (part.type === 'text')
      return <span key={key}>{part.text}</span>
    if (part.type === 'break')
      return <span key={key}> </span>
    const liveInput = inputByKey.get(`${part.slotId}\u0000${part.index}`)
    const valid = liveInput?.mediaType === part.mediaType
    const label = `@${mediaReferenceLabel(t, part.mediaType, part.index)}`
    return (
      <span
        className={cn(
          `
            inline-flex rounded-md border px-1.5 py-0.5 align-baseline
            font-medium
          `,
          valid
            ? 'border-border/70 bg-muted text-foreground'
            : 'border-destructive/60 bg-destructive/10 text-destructive',
        )}
        contentEditable={false}
        data-prompt-input-reference=""
        data-prompt-part-index={partIndex}
        key={key}
        title={valid ? `${label} · ${liveInput.name}` : invalidTooltip}
      >
        {label}
      </span>
    )
  })
}

function ActivePromptComposer({
  ariaDescribedBy,
  focusOnCreate,
  id,
  initialFocusPosition,
  inputs,
  invalidTooltip,
  label,
  placeholder,
  template,
  onBlur,
  onChange,
  onInputReferenceSelectStart,
  interactionClassName,
}: {
  ariaDescribedBy?: string
  focusOnCreate: boolean
  id: string
  initialFocusPosition: null | number
  inputs: readonly PromptComposerInput[]
  invalidTooltip: string
  label: string
  onBlur: (event: FocusEvent<HTMLDivElement>) => void
  onChange: (template: PromptTemplate) => void
  onInputReferenceSelectStart: () => void
  interactionClassName?: string
  placeholder: string
  template: PromptTemplate
}) {
  const { t } = useTranslation()
  const empty = template.parts.length === 0
  const copyRef = useRef<PromptComposerSuggestionCopy>({
    empty: t('flows.promptComposer.empty'),
    groups: {
      audio: t('flows.promptComposer.groups.audio'),
      image: t('flows.promptComposer.groups.image'),
      video: t('flows.promptComposer.groups.video'),
    },
  })
  const onChangeRef = useRef(onChange)
  const onInputReferenceSelectStartRef = useRef(onInputReferenceSelectStart)
  const editorRef = useRef<Editor | null>(null)
  const templateRef = useRef(template)
  onChangeRef.current = onChange
  onInputReferenceSelectStartRef.current = onInputReferenceSelectStart
  templateRef.current = template
  copyRef.current = {
    empty: t('flows.promptComposer.empty'),
    groups: {
      audio: t('flows.promptComposer.groups.audio'),
      image: t('flows.promptComposer.groups.image'),
      video: t('flows.promptComposer.groups.video'),
    },
  }
  const suggestions = inputs.map(input => ({
    ...input,
    displayLabel: mediaReferenceLabel(t, input.mediaType, input.index),
  }))
  const suggestionsRef = useRef(suggestions)
  suggestionsRef.current = suggestions
  const inputReference = useMemo(() => createInputReferenceExtension({
    getCopy: () => copyRef.current,
    getInputs: () => suggestionsRef.current,
    onSelectStart: () => onInputReferenceSelectStartRef.current(),
    interactionClassName,
  }), [interactionClassName])
  const editor = useEditor({
    content: promptTemplateToEditorJson({
      inputs,
      invalidTooltip,
      label: (mediaType, index) => mediaReferenceLabel(t, mediaType, index),
      template,
    }),
    editorProps: {
      attributes: {
        'aria-describedby': ariaDescribedBy ?? '',
        'aria-label': label,
        'class': 'whitespace-pre-wrap outline-none',
        'id': id,
        'role': 'textbox',
      },
      handlePaste: (view, event) => {
        const plainText = event.clipboardData?.getData('text/plain')
        const activeEditor = editorRef.current
        if (!plainText || !activeEditor)
          return false
        const { from, to } = view.state.selection
        const remainingTemplate = promptTemplateFromEditorJson(
          view.state.tr.deleteSelection().doc.toJSON(),
        )
        const availableCharacters = Math.max(
          0,
          MAX_PROMPT_CHARACTERS - promptContentSize(remainingTemplate),
        )
        const acceptedText = normalizedPlainText(plainText)
          .slice(0, availableCharacters)
        const inserted = activeEditor
          .chain()
          .focus()
          .insertContentAt(
            { from, to },
            plainTextEditorContent(acceptedText),
            { updateSelection: true },
          )
          .run()
        if (inserted)
          event.preventDefault()
        return inserted
      },
    },
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak,
      UndoRedo,
      inputReference,
      CharacterCount.configure({ limit: MAX_PROMPT_CHARACTERS }),
    ],
    immediatelyRender: true,
    onCreate: ({ editor: createdEditor }) => {
      if (!focusOnCreate)
        return
      queueMicrotask(() => createdEditor.commands.focus(
        initialFocusPosition ?? 'end',
      ))
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const next = promptTemplateFromEditorJson(updatedEditor.getJSON())
      if (promptTemplateKey(next) !== promptTemplateKey(templateRef.current))
        onChangeRef.current(next)
    },
    shouldRerenderOnTransaction: false,
  }, [])
  editorRef.current = editor

  useEffect(() => {
    if (!editor)
      return
    // The mounted editor owns content until blur. Replacing its document with
    // the graph-store echo of each keystroke would reset the live selection.
    refreshPromptInputPresentations({
      editor,
      inputs,
      invalidTooltip,
      label: (mediaType, index) => mediaReferenceLabel(t, mediaType, index),
    })
  }, [editor, inputs, invalidTooltip, t])

  return (
    <div
      className={cn('relative', interactionClassName)}
      onBlur={onBlur}
      onKeyDown={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
    >
      {empty && (
        <span className="
          pointer-events-none absolute top-0 left-0 text-muted-foreground/70
        "
        >
          {placeholder}
        </span>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

/** Configures the shared narrow prompt editor and its optional lazy preview. */
export interface PromptComposerProps {
  /** Optional help copy associated with the editable region. */
  ariaDescribedBy?: string
  /** Optional surface styling composed with the neutral editor shell. */
  className?: string
  /** Prevents inline edits while another text input is authoritative. */
  disabled?: boolean
  /** Stable DOM identity for labels and accessibility relationships. */
  id: string
  /** Surface-specific event-isolation classes, such as React Flow hooks. */
  interactionClassName?: string
  /** Mounts the editable document immediately for a singular composer surface. */
  mountEditorImmediately?: boolean
  /** Effective selected media inputs available to `@` suggestions. */
  inputs: readonly PromptComposerInput[]
  /** Localized accessible editor name. */
  label: string
  /** Localized empty prompt guidance. */
  placeholder: string
  /** Optional surface styling for the focus-lazy preview. */
  previewClassName?: string
  /** Persisted structured prompt value. */
  template: PromptTemplate
  /** Persists one normalized prompt-template update. */
  onChange: (template: PromptTemplate) => void
}

/** Renders the narrow prompt editor eagerly or behind its lightweight preview. */
export function PromptComposer({
  ariaDescribedBy,
  className,
  disabled = false,
  id,
  interactionClassName,
  inputs,
  label,
  mountEditorImmediately = false,
  placeholder,
  previewClassName,
  template,
  onChange,
}: PromptComposerProps) {
  const { t } = useTranslation()
  const [active, setActive] = useState(false)
  const pendingFocusPositionRef = useRef<null | number>(null)
  const pointerFocusPendingRef = useRef(false)
  const inputReferenceSelectionPendingRef = useRef(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const editorActive = mountEditorImmediately || active
  const invalidTooltip = t('flows.promptComposer.invalid')
  const valid = promptTemplateIsValid(template, inputs)

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget instanceof Element
      ? event.relatedTarget
      : null
    if (
      inputReferenceSelectionPendingRef.current
      || event.currentTarget.contains(nextTarget)
      || nextTarget?.closest('[data-prompt-input-menu]')
    ) {
      return
    }
    pendingFocusPositionRef.current = null
    pointerFocusPendingRef.current = false
    setActive(false)
  }

  function handleInputReferenceSelectStart() {
    inputReferenceSelectionPendingRef.current = true
    setActive(true)
    window.setTimeout(() => {
      inputReferenceSelectionPendingRef.current = false
    }, 0)
  }

  function handleMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    const preview = previewRef.current
    if (
      disabled
      || event.button !== 0
      || !preview
      || !(event.target instanceof Node)
      || !preview.contains(event.target)
    ) {
      return
    }
    pendingFocusPositionRef.current = promptPositionAtPoint({
      clientX: event.clientX,
      clientY: event.clientY,
      root: preview,
      target: event.target,
      template,
    })
    pointerFocusPendingRef.current = true
  }

  function handleClick(event: ReactMouseEvent<HTMLDivElement>) {
    const preview = previewRef.current
    if (
      disabled
      || !pointerFocusPendingRef.current
      || !preview
      || !(event.target instanceof Node)
      || !preview.contains(event.target)
    ) {
      return
    }
    pointerFocusPendingRef.current = false
    setActive(true)
  }

  return (
    <div
      aria-disabled={disabled}
      aria-invalid={!valid}
      className={cn(
        `
          no-scrollbar max-h-60 min-h-10 overflow-y-auto overscroll-y-contain
          rounded-lg border p-2.5 text-xs/relaxed
          transition-[background-color,border-color]
          duration-(--flow-motion-fast) ease-(--flow-motion-ease)
          motion-reduce:transition-none
        `,
        disabled
          ? 'cursor-not-allowed border-transparent bg-muted/25 opacity-65'
          : `
            cursor-text border-transparent bg-muted/40
            focus-within:border-(--flow-node-accent,var(--ring))
            focus-within:bg-background/80
            hover:bg-muted/55
          `,
        interactionClassName,
        className,
      )}
      onFocus={(event) => {
        if (
          !disabled
          && !pointerFocusPendingRef.current
          && previewRef.current
          && event.target instanceof Node
          && previewRef.current.contains(event.target)
        ) {
          setActive(true)
        }
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {editorActive && !disabled
        ? (
            <ActivePromptComposer
              ariaDescribedBy={ariaDescribedBy}
              focusOnCreate={!mountEditorImmediately}
              id={id}
              initialFocusPosition={pendingFocusPositionRef.current}
              inputs={inputs}
              invalidTooltip={invalidTooltip}
              interactionClassName={interactionClassName}
              label={label}
              placeholder={placeholder}
              template={template}
              onBlur={handleBlur}
              onChange={onChange}
              onInputReferenceSelectStart={handleInputReferenceSelectStart}
            />
          )
        : (
            <div
              ref={previewRef}
              aria-describedby={ariaDescribedBy}
              aria-label={label}
              className={cn('h-5 truncate outline-none', previewClassName)}
              id={id}
              role="textbox"
              tabIndex={disabled ? -1 : 0}
            >
              <PromptTemplatePreview
                inputs={inputs}
                invalidTooltip={invalidTooltip}
                placeholder={placeholder}
                template={template}
              />
            </div>
          )}
    </div>
  )
}
