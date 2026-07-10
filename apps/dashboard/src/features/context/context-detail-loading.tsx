import { Skeleton } from '@talelabs/ui/components/skeleton'

export function ContextDetailLoading() {
  return (
    <div className="
      flex flex-col gap-5 p-5
      md:p-8
    "
    >
      <Skeleton className="h-8 w-2/5 rounded-md" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  )
}
