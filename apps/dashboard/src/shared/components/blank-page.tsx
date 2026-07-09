export function BlankPage({
  title,
}: {
  title: string
}) {
  return <section aria-label={title} className="min-h-[calc(100svh-8rem)]" />
}
