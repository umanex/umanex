/** @type {import('next').NextConfig} */
const nextConfig = {
  // De flow-harness bouwt in een eigen map, niet in `.next`. Zonder dit deelt hij die map
  // met de dev-server op 3003 — en `next build` maakt de doelmap eerst leeg, dus die server
  // serveert daarna een witte pagina. Zelfde constructie als `apps/cashflow/next.config.mjs`.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@umanex/ui', '@umanex/tokens'],
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
}

export default nextConfig
