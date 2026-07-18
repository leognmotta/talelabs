/** Next.js build composition for the public TaleLabs website. */

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@talelabs/ui'],
}

export default nextConfig
