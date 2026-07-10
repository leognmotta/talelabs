import { IconArrowLeft, IconPencil, IconTrash } from '@tabler/icons-react'
import { Button, buttonVariants } from '@talelabs/ui/components/button'
import { Link } from 'react-router'

export function ContextDetailHeader({
  backTo,
  deleteLabel,
  editTo,
  onDelete,
  subtitle,
  title,
}: {
  backTo: string
  deleteLabel: string
  editTo: string
  onDelete: () => void
  subtitle: string
  title: string
}) {
  return (
    <header className="
      flex flex-wrap items-start justify-between gap-4 border-b p-5
      md:p-8
    "
    >
      <div className="flex min-w-0 gap-3">
        <Link
          aria-label={`Back to ${backTo.slice(1)}`}
          className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
          to={backTo}
        >
          <IconArrowLeft />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold wrap-break-word">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Link
          className={buttonVariants({ size: 'sm', variant: 'outline' })}
          to={editTo}
        >
          <IconPencil data-icon="inline-start" />
          Edit
        </Link>
        <Button
          aria-label={deleteLabel}
          size="icon-sm"
          type="button"
          variant="destructive"
          onClick={onDelete}
        >
          <IconTrash />
        </Button>
      </div>
    </header>
  )
}
