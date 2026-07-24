/**
 * Shared document typography for Project Brief reading and editing surfaces.
 *
 * Keeping one visual contract prevents the Tiptap editor from changing shape
 * when the author moves between read and edit modes.
 */

/** Notion-style prose rhythm shared by both Project Brief presentations. */
export const PROJECT_BRIEF_DOCUMENT_CLASS_NAME = `
  w-full max-w-none text-[15px]/7 text-foreground
  [&_.ProseMirror]:outline-none
  [&_.ProseMirror>*:first-child]:mt-0
  [&_.ProseMirror_a]:cursor-pointer
  [&_.ProseMirror_blockquote]:my-5
  [&_.ProseMirror_blockquote]:border-l-2
  [&_.ProseMirror_blockquote]:border-foreground/20
  [&_.ProseMirror_blockquote]:pl-4
  [&_.ProseMirror_blockquote]:text-muted-foreground
  [&_.ProseMirror_h1]:mt-12 [&_.ProseMirror_h1]:mb-4
  [&_.ProseMirror_h1]:text-3xl/9 [&_.ProseMirror_h1]:font-bold
  [&_.ProseMirror_h1]:tracking-tight
  [&_.ProseMirror_h2]:mt-10 [&_.ProseMirror_h2]:mb-3
  [&_.ProseMirror_h2]:text-2xl/8 [&_.ProseMirror_h2]:font-semibold
  [&_.ProseMirror_h2]:tracking-tight
  [&_.ProseMirror_h3]:mt-8 [&_.ProseMirror_h3]:mb-2
  [&_.ProseMirror_h3]:text-xl/7 [&_.ProseMirror_h3]:font-semibold
  [&_.ProseMirror_h4]:mt-6 [&_.ProseMirror_h4]:mb-2
  [&_.ProseMirror_h4]:text-base/7 [&_.ProseMirror_h4]:font-semibold
  [&_.ProseMirror_hr]:my-8 [&_.ProseMirror_hr]:border-border
  [&_.ProseMirror_li]:my-1 [&_.ProseMirror_li]:ml-6
  [&_.ProseMirror_ol]:my-4 [&_.ProseMirror_ol]:list-decimal
  [&_.ProseMirror_p]:my-3
  [&_.ProseMirror_ul]:my-4 [&_.ProseMirror_ul]:list-disc
  [&_.ProseMirror_ul[data-type=taskList]]:list-none
  [&_.ProseMirror_ul[data-type=taskList]]:my-5
  [&_.ProseMirror_ul[data-type=taskList]]:pl-0
  [&_.ProseMirror_ul[data-type=taskList]]:space-y-1
  [&_.ProseMirror_ul[data-type=taskList]>li]:my-0
  [&_.ProseMirror_ul[data-type=taskList]>li]:ml-0
  [&_.ProseMirror_ul[data-type=taskList]>li]:flex
  [&_.ProseMirror_ul[data-type=taskList]>li]:items-start
  [&_.ProseMirror_ul[data-type=taskList]>li]:gap-3
  [&_.ProseMirror_ul[data-type=taskList]>li]:py-1
  [&_.ProseMirror_ul[data-type=taskList]>li>label]:mt-1.5
  [&_.ProseMirror_ul[data-type=taskList]>li>label]:flex
  [&_.ProseMirror_ul[data-type=taskList]>li>label]:shrink-0
  [&_.ProseMirror_ul[data-type=taskList]>li>label]:cursor-pointer
  [&_.ProseMirror_ul[data-type=taskList]>li>label>input]:size-4
  [&_.ProseMirror_ul[data-type=taskList]>li>label>input]:cursor-pointer
  [&_.ProseMirror_ul[data-type=taskList]>li>label>input]:accent-primary
  [&_.ProseMirror_ul[data-type=taskList]>li>label>span]:hidden
  [&_.ProseMirror_ul[data-type=taskList]>li>div]:min-w-0
  [&_.ProseMirror_ul[data-type=taskList]>li>div]:flex-1
  [&_.ProseMirror_ul[data-type=taskList]>li>div>p]:my-0
  [&_.ProseMirror_ul[data-type=taskList]>li[data-checked=true]>div]:text-muted-foreground
  [&_.ProseMirror_ul[data-type=taskList]>li[data-checked=true]>div]:line-through
`
