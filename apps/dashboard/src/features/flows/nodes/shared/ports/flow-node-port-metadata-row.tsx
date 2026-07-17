/** Displays one label/value pair in compact port-item metadata. */
export function FlowNodePortMetadataRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-36 truncate text-right font-medium" title={value}>
        {value}
      </dd>
    </div>
  )
}
