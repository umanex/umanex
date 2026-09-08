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
    // Twee Figma-bestanden, en het verschil is niet uit de namen af te lezen:
    // "Design System" is de library waar de componenten in staan en waar Storybook
    // tegenaan hangt (33 stories dragen er een deep-link naartoe); "Design" is waar
    // de effectieve schermen gebouwd worden, met instances uit die library. Een kale
    // "Figma"-link zou dus de helft van de tijd de verkeerde openen.
    links: [
      { label: 'Storybook', href: 'http://localhost:6007' },
      { label: 'Figma · library', href: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20%E2%80%94%20Design%20System' },
      { label: 'Figma · schermen', href: 'https://www.figma.com/design/T1bGrvIzSNeLyh5CbarATZ/RowTrack---Design' },
    ],
    scripts: ['test', 'tokens:build', 'storybook', 'parity', 'figma:check'],
  },
];

export function appById(id: string): AppConfig | undefined {
  return APPS.find((a) => a.id === id);
}
