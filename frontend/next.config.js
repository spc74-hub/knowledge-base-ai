/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    domains: ['i.ytimg.com', 'p16-sign-sg.tiktokcdn.com'],
    unoptimized: process.env.NODE_ENV === 'production',
  },
}

module.exports = nextConfig
