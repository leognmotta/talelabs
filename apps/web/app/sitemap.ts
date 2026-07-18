/** Canonical public URL inventory for TaleLabs discovery. */

import type { MetadataRoute } from 'next'

import { PUBLIC_SITE_URL } from '@/lib/site'

/** Returns the current single-page public website entry. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    changeFrequency: 'weekly',
    lastModified: new Date(),
    priority: 1,
    url: PUBLIC_SITE_URL,
  }]
}
