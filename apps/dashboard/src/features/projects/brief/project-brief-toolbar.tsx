/** Sticky formatting toolbar and link editor for one Project Brief editor. */

import type { Editor } from '@tiptap/core'
import type { FormEvent } from 'react'

import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBold,
  IconChecklist,
  IconH1,
  IconH2,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconMinus,
  IconQuote,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { Input } from '@talelabs/ui/components/input'
import { Separator } from '@talelabs/ui/components/separator'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  ProjectBriefToolbarButton,
} from './project-brief-toolbar-button'

/** Renders all formatting commands for one mounted Project Brief editor. */
export function ProjectBriefToolbar({ editor }: {
  /** Active Tiptap editor receiving every toolbar command. */
  editor: Editor
}) {
  const { t } = useTranslation()
  const [linkHref, setLinkHref] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)

  function saveLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const href = linkHref.trim()
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    }
    else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    setLinkOpen(false)
  }

  return (
    <>
      <div
        aria-label={t('projects.briefToolbar')}
        className="
          sticky top-14 z-10 mb-8 flex w-fit max-w-full flex-wrap items-center
          gap-0.5 rounded-lg border bg-background/95 px-2 py-1.5 shadow-sm
          backdrop-blur-sm
        "
        role="toolbar"
      >
        <ProjectBriefToolbarButton
          disabled={!editor.can().undo()}
          label={t('common.undo')}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <IconArrowBackUp />
        </ProjectBriefToolbarButton>
        <ProjectBriefToolbarButton
          disabled={!editor.can().redo()}
          label={t('common.redo')}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <IconArrowForwardUp />
        </ProjectBriefToolbarButton>
        <Separator className="mx-1 h-5!" orientation="vertical" />
        <ProjectBriefToolbarButton
          active={editor.isActive('bold')}
          label={t('projects.briefBold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <IconBold />
        </ProjectBriefToolbarButton>
        <ProjectBriefToolbarButton
          active={editor.isActive('italic')}
          label={t('projects.briefItalic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <IconItalic />
        </ProjectBriefToolbarButton>
        <ProjectBriefToolbarButton
          active={editor.isActive('heading', { level: 1 })}
          label={t('projects.briefHeadingOne')}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <IconH1 />
        </ProjectBriefToolbarButton>
        <ProjectBriefToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          label={t('projects.briefHeadingTwo')}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <IconH2 />
        </ProjectBriefToolbarButton>
        <Separator className="mx-1 h-5!" orientation="vertical" />
        <ProjectBriefToolbarButton
          active={editor.isActive('bulletList')}
          label={t('projects.briefBulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <IconList />
        </ProjectBriefToolbarButton>
        <ProjectBriefToolbarButton
          active={editor.isActive('orderedList')}
          label={t('projects.briefNumberedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <IconListNumbers />
        </ProjectBriefToolbarButton>
        <ProjectBriefToolbarButton
          active={editor.isActive('taskList')}
          label={t('projects.briefTaskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <IconChecklist />
        </ProjectBriefToolbarButton>
        <ProjectBriefToolbarButton
          active={editor.isActive('blockquote')}
          label={t('projects.briefQuote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <IconQuote />
        </ProjectBriefToolbarButton>
        <ProjectBriefToolbarButton
          label={t('projects.briefDivider')}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <IconMinus />
        </ProjectBriefToolbarButton>
        <ProjectBriefToolbarButton
          active={editor.isActive('link')}
          label={t('projects.briefLink')}
          onClick={() => {
            setLinkHref(String(editor.getAttributes('link').href ?? ''))
            setLinkOpen(true)
          }}
        >
          <IconLink />
        </ProjectBriefToolbarButton>
      </div>
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent closeLabel={t('common.close')}>
          <form className="space-y-5" onSubmit={saveLink}>
            <DialogHeader>
              <DialogTitle>{t('projects.briefLink')}</DialogTitle>
              <DialogDescription>
                {t('projects.briefLinkPrompt')}
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              aria-label={t('projects.briefLink')}
              type="url"
              value={linkHref}
              onChange={event => setLinkHref(event.target.value)}
            />
            <DialogFooter>
              <Button type="submit">{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
