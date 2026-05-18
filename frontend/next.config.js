/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    domains: ['i.ytimg.com', 'p16-sign-sg.tiktokcdn.com'],
    unoptimized: process.env.NODE_ENV === 'production',
  },
  async redirects() {
    // Pages removed in the strategic-layer refactor (CHANGELOG 2026-05-18).
    // ContentHub now owns AI-driven exploration; Kbia keeps only the PARA layer.
    return [
      { source: '/explore', destination: '/dashboard', permanent: true },
      { source: '/explore/:path*', destination: '/dashboard', permanent: true },
      { source: '/chat', destination: '/dashboard', permanent: true },
      { source: '/chat/:path*', destination: '/dashboard', permanent: true },
      { source: '/processing', destination: '/dashboard', permanent: true },
      { source: '/processing/:path*', destination: '/dashboard', permanent: true },
      { source: '/taxonomy', destination: '/dashboard', permanent: true },
      { source: '/taxonomy/:path*', destination: '/dashboard', permanent: true },
      { source: '/knowledge-graph', destination: '/dashboard', permanent: true },
      { source: '/knowledge-graph/:path*', destination: '/dashboard', permanent: true },
      { source: '/import', destination: '/captures', permanent: true },
      { source: '/import/:path*', destination: '/captures', permanent: true },
      { source: '/import-apple-notes', destination: '/apple-notes', permanent: true },
      { source: '/experts', destination: '/dashboard', permanent: true },
      { source: '/experts/:path*', destination: '/dashboard', permanent: true },
    ];
  },
}

module.exports = nextConfig
