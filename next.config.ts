import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Versão em Markdown do post e das páginas (passo 7): /posts/slug.md e /sobre.md
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/posts/:slug([a-z0-9-]+).md', destination: '/md/posts/:slug' },
        { source: '/:slug([a-z0-9-]+).md', destination: '/md/pages/:slug' },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
  async redirects() {
    // o RSS mora em /rss.xml; /feed.xml fica como atalho antigo
    return [{ source: '/feed.xml', destination: '/rss.xml', permanent: true }]
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
