export function SplashScreen({
  message = 'Loading workspace',
}: {
  message?: string
}) {
  return (
    <main className="
      flex min-h-screen items-center justify-center bg-background px-6 py-8
      text-foreground
    "
    >
      <section className="
        flex w-full max-w-sm flex-col items-center gap-5 text-center
      "
      >
        <div className="
          flex size-14 items-center justify-center rounded-lg bg-primary text-xl
          font-semibold text-primary-foreground shadow-lg
        "
        >
          C
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">TaleLabs</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex w-36 flex-col gap-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 rounded-full bg-primary" />
          </div>
        </div>
      </section>
    </main>
  )
}
