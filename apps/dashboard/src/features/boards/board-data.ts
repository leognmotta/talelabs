export const boardPreviews = [
  {
    accent: 'from-amber-500/20 via-emerald-500/15 to-cyan-500/20',
    eyebrow: 'BACKGROUND REMOVAL',
    title: 'Product portrait cleanup',
    tone: 'warm',
  },
  {
    accent: 'from-pink-500/20 via-sky-500/15 to-violet-500/20',
    eyebrow: 'CHARACTER SHEETS',
    title: 'Expression study',
    tone: 'cool',
  },
  {
    accent: 'from-foreground/5 via-muted to-foreground/10',
    eyebrow: 'UNTITLED',
    title: 'Storyboard draft',
    tone: 'neutral',
  },
] as const

export type BoardPreview = typeof boardPreviews[number]

export type PreviewTone = BoardPreview['tone']

export function getPreviewSurface(tone: PreviewTone) {
  if (tone === 'warm')
    return 'bg-amber-950/15'

  if (tone === 'cool')
    return 'bg-sky-950/15'

  return 'bg-foreground/5'
}

export function getPreviewGradient(tone: PreviewTone) {
  if (tone === 'warm')
    return 'from-amber-200/70 via-emerald-300/50 to-slate-900/50'

  if (tone === 'cool')
    return 'from-cyan-200/70 via-violet-300/50 to-fuchsia-900/50'

  return 'from-muted via-foreground/10 to-muted'
}
