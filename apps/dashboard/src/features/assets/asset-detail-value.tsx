export function AssetDetailValue({ label, value }: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate" title={value}>{value}</dd>
    </div>
  )
}
