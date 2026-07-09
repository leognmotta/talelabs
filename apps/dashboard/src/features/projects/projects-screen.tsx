import {
  IconArrowUp,
  IconMicrophone,
  IconPaperclip,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import { Input } from '@talelabs/ui/components/input'
import { Tabs, TabsList, TabsTrigger } from '@talelabs/ui/components/tabs'
import { Textarea } from '@talelabs/ui/components/textarea'

const boardPreviews = [
  {
    accent: 'from-amber-500/20 via-emerald-500/15 to-cyan-500/20',
    eyebrow: 'BACKGROUND REMOVAL',
    title: 'Product portrait cleanup',
    tone: 'warm',
  },
  {
    accent: 'from-pink-500/20 via-sky-500/15 to-violet-500/20',
    eyebrow: 'CHARACTER SHEETS',
    title: 'Expression study',
    tone: 'cool',
  },
  {
    accent: 'from-foreground/5 via-muted to-foreground/10',
    eyebrow: 'UNTITLED',
    title: 'Storyboard draft',
    tone: 'neutral',
  },
] as const

export function ProjectsScreen(_props: {
  activeOrganizationId: string | null
  meQueryStatus: string
  organizationMessage: string
}) {
  return (
    <div className="flex min-h-[calc(100svh-8rem)] flex-col gap-12">
      <section className="
        mx-auto flex w-full max-w-2xl flex-col items-center gap-6 pt-8
        text-center
      "
      >
        <h1 className="text-2xl font-medium tracking-normal">
          What do you want to create today?
        </h1>

        <Card className="w-full rounded-4xl bg-muted/40 py-0 shadow-none">
          <CardContent className="flex flex-col gap-3 p-4">
            <Textarea
              className="
                min-h-20 border-0 bg-transparent text-base shadow-none
                focus-visible:ring-0
              "
              placeholder="Describe what you want to create..."
            />
            <div className="flex items-center justify-end gap-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Attach file">
                <IconPaperclip data-icon="inline-start" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Record prompt">
                <IconMicrophone data-icon="inline-start" />
              </Button>
              <Button type="button" size="icon-sm" aria-label="Create">
                <IconArrowUp data-icon="inline-start" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-5">
        <div className="relative w-full max-w-64">
          <IconSearch className="
            pointer-events-none absolute top-1/2 left-3 -translate-y-1/2
            text-muted-foreground
          "
          />
          <Input
            className="bg-muted/50 pl-9"
            placeholder="Search boards..."
            aria-label="Search boards"
          />
        </div>

        <Tabs defaultValue="mine">
          <TabsList variant="line">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="mine">Mine</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="
          grid gap-4
          md:grid-cols-2
          xl:grid-cols-4
        "
        >
          <CreateBoardCard />
          {boardPreviews.map(board => (
            <BoardCard key={board.title} board={board} />
          ))}
        </div>
      </section>
    </div>
  )
}

function CreateBoardCard() {
  return (
    <Card className="
      min-h-52 justify-center rounded-3xl bg-muted/50 py-0 shadow-none
    "
    >
      <CardContent className="
        flex flex-col items-center justify-center gap-3 p-6
      "
      >
        <Button type="button" variant="ghost" size="icon-lg" aria-label="New board">
          <IconPlus />
        </Button>
      </CardContent>
    </Card>
  )
}

function BoardCard({
  board,
}: {
  board: typeof boardPreviews[number]
}) {
  return (
    <Card className="min-h-52 rounded-3xl bg-muted/50 py-0 shadow-none">
      <CardHeader className="px-4 pt-4">
        <CardDescription className="text-xs font-medium tracking-normal">
          {board.eyebrow}
        </CardDescription>
        <CardTitle className="truncate text-sm">{board.title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className={`
          grid h-32 grid-cols-[1.4fr_1fr] gap-3 rounded-2xl bg-linear-to-br p-3
          ${board.accent}
        `}
        >
          <PreviewHero tone={board.tone} />
          <div className="grid grid-cols-2 gap-2">
            <PreviewTile tone={board.tone} />
            <PreviewTile tone={board.tone} />
            <PreviewTile tone={board.tone} />
            <PreviewTile tone={board.tone} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PreviewHero({
  tone,
}: {
  tone: 'cool' | 'neutral' | 'warm'
}) {
  return (
    <div className={`
      overflow-hidden rounded-xl
      ${getPreviewSurface(tone)}
    `}
    >
      <div className={`
        size-full rounded-xl bg-linear-to-br
        ${getPreviewGradient(tone)}
      `}
      />
    </div>
  )
}

function PreviewTile({
  tone,
}: {
  tone: 'cool' | 'neutral' | 'warm'
}) {
  return (
    <div className={`
      rounded-xl
      ${getPreviewSurface(tone)}
    `}
    >
      <div className={`
        size-full rounded-xl bg-linear-to-br opacity-80
        ${getPreviewGradient(tone)}
      `}
      />
    </div>
  )
}

function getPreviewSurface(tone: 'cool' | 'neutral' | 'warm') {
  if (tone === 'warm')
    return 'bg-amber-950/15'

  if (tone === 'cool')
    return 'bg-sky-950/15'

  return 'bg-foreground/5'
}

function getPreviewGradient(tone: 'cool' | 'neutral' | 'warm') {
  if (tone === 'warm')
    return 'from-amber-200/70 via-emerald-300/50 to-slate-900/50'

  if (tone === 'cool')
    return 'from-cyan-200/70 via-violet-300/50 to-fuchsia-900/50'

  return 'from-muted via-foreground/10 to-muted'
}
