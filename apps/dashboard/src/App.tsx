import { Button } from '@connecto/ui/components/button'
import { useState } from 'react'

function App() {
  const [deployments, setDeployments] = useState(12)

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-3 border-b border-border pb-6">
          <p className="text-sm font-medium text-muted-foreground">
            Connecto dashboard
          </p>
          <div className="
            flex flex-col gap-4
            sm:flex-row sm:items-end sm:justify-between
          "
          >
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                Shared UI package mounted
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                This screen imports Button from @connecto/ui and renders it in
                the dashboard app.
              </p>
            </div>
            <Button onClick={() => setDeployments(value => value + 1)}>
              Add deployment
            </Button>
          </div>
        </header>

        <section className="
          grid gap-4
          md:grid-cols-3
        "
        >
          <div className="
            rounded-lg border border-border bg-card p-5 text-card-foreground
          "
          >
            <p className="text-sm text-muted-foreground">Deployments</p>
            <p className="mt-2 text-4xl font-semibold">{deployments}</p>
          </div>
          <div className="
            rounded-lg border border-border bg-card p-5 text-card-foreground
          "
          >
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="mt-2 text-2xl font-semibold">Ready</p>
          </div>
          <div className="
            rounded-lg border border-border bg-card p-5 text-card-foreground
          "
          >
            <p className="text-sm text-muted-foreground">Package</p>
            <p className="mt-2 text-2xl font-semibold">@connecto/ui</p>
          </div>
        </section>

        <section className="
          flex flex-wrap items-center gap-3 rounded-lg border border-border
          bg-card p-5 text-card-foreground
        "
        >
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </section>
      </section>
    </main>
  )
}

export default App
