import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-native-web-vite';

/**
 * RowTrack rendert zijn React Native-componenten in de browser via react-native-web.
 * Zelfde Storybook-major als packages/ui (10.x), zodat deze Storybook daar als `ref`
 * kan hangen — de vorm die CLAUDE.md voorschrijft voor een app met een eigen tokenbron.
 *
 * `vite-tsconfig-paths` zit in het framework-pakket, dus de `@/…`-alias uit tsconfig.json
 * werkt zonder extra config. De web-varianten van de Expo-modules komen uit
 * `resolve.extensions` die vite-plugin-rnw zet (.web.tsx vóór .tsx).
 */

/**
 * Modules die in een browser niet kunnen bestaan, met hun vervanger.
 *
 * De sleutel is een BESTANDSPAD-staart, niet een import-specifier. Dat is niet
 * cosmetisch: `lib/supabase.ts` wordt op twee manieren geïmporteerd — als `@/lib/supabase`
 * (hooks, components) én als `./supabase` (lib/auth-context.tsx, lib/auth.ts,
 * lib/health-consent-context.tsx). Een `resolve.alias` op de specifier vangt alleen de
 * eerste vorm; gemeten 2026-09-07 bleef de smoke-story dan met exact dezelfde fout staan
 * terwijl de alias er wél was. Door ná resolutie te matchen, is er nog maar één plek waar
 * het bestand langskomt en doet de vorm van de import niet meer ter zake.
 */
const MOCKS: Record<string, string> = {
  '/lib/supabase.ts': './mocks/supabase.ts',
};

const config: StorybookConfig = {
  stories: ['../docs/**/*.mdx', '../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  staticDirs: ['./public'],
  framework: { name: '@storybook/react-native-web-vite', options: {} },
  core: { disableTelemetry: true },
  viteFinal: async (config) => {
    config.plugins ??= [];
    config.plugins.unshift({
      name: 'rowtrack-storybook-mocks',
      enforce: 'pre',
      async resolveId(source: string, importer: string | undefined, options: any) {
        if (options?.custom?.rowtrackMock) return null;
        const opgelost = await (this as any).resolve(source, importer, { ...options, skipSelf: true });
        if (!opgelost) return null;
        const pad = opgelost.id.split('?')[0].replace(/\\/g, '/');
        for (const [staart, vervanger] of Object.entries(MOCKS)) {
          if (pad.endsWith(staart)) return fileURLToPath(new URL(vervanger, import.meta.url));
        }
        return null;
      },
    } as any);
    return config;
  },
};

export default config;
