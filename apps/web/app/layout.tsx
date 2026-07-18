/** Root document, localized metadata, and system-theme bootstrap for TaleLabs. */

import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { getWebI18n } from '@/lib/i18n'
import { PUBLIC_SITE_URL } from '@/lib/site'

import '@talelabs/ui/globals.css'
import './site.css'

/** Defines browser chrome colors for the dark editorial website theme. */
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0c0c0b',
}

/** Builds request-localized discovery metadata for the homepage. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getWebI18n()
  const title = t('metadata.title')
  const description = t('metadata.description')

  return {
    metadataBase: new URL(PUBLIC_SITE_URL),
    title,
    description,
    alternates: { canonical: '/' },
    openGraph: {
      title,
      description,
      siteName: 'TaleLabs',
      type: 'website',
      url: '/',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

/** Renders the localized root document without adding a client application shell. */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await getWebI18n()

  return (
    <html lang={locale} dir="ltr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
