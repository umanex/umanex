import type { AppConfig } from './types';

/**
 * De app-lijst is statisch en staat in de repo — niet afgeleid uit `apps/*`.
 * Reden: modus, poort en het startcommando zijn oordelen, geen feiten die uit een
 * package.json volgen. rowtrack heeft geen `dev`-script maar moet `expo start
 * --dev-client` draaien; cashflow's `dev` claimt een poort die PM2 al bezit. Een
 * afgeleide lijst zou die twee stil verkeerd hebben.
 *
 * Het dashboard staat er bewust niet zelf in.
 */
export const APPS: AppConfig[] = [
  {
    id: 'cashflow',
    label: 'Cashflow',
    mode: 'inline',
    startCommand: 'pnpm dev',
    port: 3000,
    localUrl: 'http://localhost:3000',
    links: [{ label: 'Supabase', href: 'https://supabase.com/dashboard/project/fwgpqvtouvbijzsuvmnk' }],
    scripts: ['type-check', 'lint', 'build', 'flow'],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    mode: 'inline',
    startCommand: 'pnpm dev',
    port: 3001,
    localUrl: 'http://localhost:3001',
    links: [{ label: 'umanex.be', href: 'https://umanex.be' }],
    scripts: ['type-check', 'lint', 'build', 'flow'],
  },
  {
    id: 'vyvey',
    label: 'Vyvey',
    mode: 'inline',
    startCommand: 'pnpm dev',
    port: 3002,
    localUrl: 'http://localhost:3002',
    links: [],
    scripts: ['type-check', 'lint', 'build', 'flow'],
  },
  {
    id: 'jobradar',
    label: 'Jobradar',
    mode: 'inline',
    startCommand: 'pnpm dev',
    port: 3003,
    localUrl: 'http://localhost:3003',
    links: [],
    scripts: ['type-check', 'lint', 'build', 'db:studio', 'flow'],
  },
  {
    id: 'rowtrack-web',
    label: 'RowTrack web',
    mode: 'inline',
    startCommand: 'pnpm dev',
    port: 3004,
    localUrl: 'http://localhost:3004',
    links: [],
    scripts: ['type-check', 'lint', 'build', 'flow'],
  },
  {
    id: 'soda-plus',
    label: 'soda+',
    mode: 'inline',
    startCommand: 'pnpm dev',
    port: 3005,
    localUrl: 'http://localhost:3005',
    links: [
      { label: 'Figma', href: 'https://www.figma.com/design/XwEUhY92XX32sQkEIdbEFN' },
    ],
    scripts: ['type-check', 'lint', 'build'],
  },
  {
    id: 'rowtrack',
    label: 'RowTrack (Expo)',
    mode: 'terminal',
    // Niet het `start`-script (`expo start`): de dev-client is wat op het toestel draait.
    startCommand: 'npx expo start --dev-client',
    // Metro, niet een Next.js-poort. Storybook draait apart op 6007.
    port: 8081,
    localUrl: null,
    links: [
      { label: 'Storybook', href: 'http://localhost:6007' },
      // Bron: apps/rowtrack/figma-map.md
      { label: 'Figma', href: 'https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack' },
    ],
    scripts: ['test', 'tokens:build', 'storybook', 'parity', 'figma:check'],
  },
];

export function appById(id: string): AppConfig | undefined {
  return APPS.find((a) => a.id === id);
}
