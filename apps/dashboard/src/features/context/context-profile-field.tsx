export function ContextProfileField({
  fallback = 'Not set',
  label,
  value,
}: {
  fallback?: string
  label: string
  value: string | null | undefined
}) {
  return (
    <section>
      <h2 className="text-sm font-medium">{label}</h2>
      <p className="mt-2 text-sm/6 whitespace-pre-wrap text-muted-foreground">
        {value || fallback}
      </p>
    </section>
  )
}
