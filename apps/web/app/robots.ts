/** Search crawler policy for the public TaleLabs website. */

import type { MetadataRoute } from 'next'

import { PUBLIC_SITE_URL } from '@/lib/site'

/** Exposes the public homepage and points crawlers to its sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { allow: '/', userAgent: '*' },
    sitemap: `${PUBLIC_SITE_URL}/sitemap.xml`,
  }
}
