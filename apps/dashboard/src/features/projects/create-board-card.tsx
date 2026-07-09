import { IconPlus } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Card, CardContent } from '@talelabs/ui/components/card'

export function CreateBoardCard() {
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
