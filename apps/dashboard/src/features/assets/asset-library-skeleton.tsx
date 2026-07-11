import { Skeleton } from '@talelabs/ui/components/skeleton'

export function AssetLibrarySkeleton() {
  return (
    <div className="
      grid grid-cols-2 gap-4 py-5
      sm:grid-cols-3
      lg:grid-cols-4
      xl:grid-cols-5
      2xl:grid-cols-6
    "
    >
      {Array.from({ length: 10 }, (_, index) => (
        <div className="flex flex-col gap-2" key={index}>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  )
}
