import type { Config } from 'tailwindcss';
import preset from '@umanex/config/tailwind/preset';

// Kleuren, borderRadius, fontFamily, darkMode en de animate-plugin komen uit de
// gedeelde preset. Hier hoort alleen nog wat écht app-specifiek is.
const config: Config = {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui/components/**/*.{ts,tsx}',
    '../../packages/ui/lib/**/*.{ts,tsx}',
  ],
};

export default config;
