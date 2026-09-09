/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@umanex/ui', '@umanex/tokens'],
  // `next dev` schrijft in een eigen map, want de PM2-app op :3010 serveert `.next`
  // en `next start` faalt op *Could not find a production build* zodra dev die map
  // heeft overschreven. Zonder de variabele blijft het `.next` — dat is wat PM2 leest.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
