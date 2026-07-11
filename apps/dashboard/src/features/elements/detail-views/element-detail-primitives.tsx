import type { ReactNode } from 'react'

import { cn } from '@talelabs/ui/lib/utils'

function keyedStrings(values: string[]) {
  const occurrences = new Map<string, number>()
  return values.map((value) => {
    const occurrence = (occurrences.get(value) ?? 0) + 1
    occurrences.set(value, occurrence)
    return { key: `${value}:${occurrence}`, value }
  })
}

export function ElementContextSection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="
        grid gap-x-10 gap-y-6
        md:grid-cols-2
      "
      >
        {children}
      </div>
    </section>
  )
}

export function ElementContextField({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <div className="mt-2">{children}</div>
    </div>
  )
}

export function ElementContextText({ value }: { value: string }) {
  return <p className="text-sm/relaxed whitespace-pre-wrap">{value}</p>
}

export function ElementNumberedList({ values }: { values: string[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {keyedStrings(values).map((item, index) => (
        <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 text-sm" key={item.key}>
          <span className="text-right text-muted-foreground tabular-nums">
            {`${index + 1}.`}
          </span>
          <span>{item.value}</span>
        </li>
      ))}
    </ol>
  )
}

export function ElementColorPalette({ colors }: { colors: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {keyedStrings(colors).map(color => (
        <span
          className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
          key={color.key}
        >
          <span
            aria-hidden="true"
            className="size-5 rounded-sm border"
            style={{ backgroundColor: color.value }}
          />
          <span className="font-mono text-xs uppercase">{color.value}</span>
        </span>
      ))}
    </div>
  )
}
