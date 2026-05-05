import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@umanex/ui', '@umanex/tokens'],
  webpack: (config) => {
    // Forceer webpack om react en react-dom altijd vanéén locatie te resolven.
    // Dit voorkomt dat styled-jsx (of andere packages) hun eigen geneste
    // React-kopie laden naast Next.js's interne react-dom tijdens SSR.
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    };
    return config;
  },
};

export default nextConfig;
