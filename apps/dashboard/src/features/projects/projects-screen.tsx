import {
  IconArrowUp,
  IconMicrophone,
  IconPaperclip,
  IconSearch,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Card, CardContent } from '@talelabs/ui/components/card'
import { Input } from '@talelabs/ui/components/input'
import { Tabs, TabsList, TabsTrigger } from '@talelabs/ui/components/tabs'
import { Textarea } from '@talelabs/ui/components/textarea'
import { BoardCard } from './board-card'
import { CreateBoardCard } from './create-board-card'
import { boardPreviews } from './project-board-data'

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
