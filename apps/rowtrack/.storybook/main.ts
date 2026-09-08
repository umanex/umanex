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
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {
      /**
       * Dezelfde babel-transform als de app zelf draait (`babel.config.js`).
       *
       * Reanimated 4 verplaatst zijn worklet-transform naar `react-native-worklets/plugin`,
       * en zonder die plugin compileert een `useAnimatedStyle`-callback tot een gewone
       * functie. Dat faalt niet bij de build: `storybook build` gaf exit 0 en pas de
       * render gooide `[Reanimated] Passed a function that is not a worklet` — gemeten
       * 2026-09-07 op 26 van 197 stories (WheelPicker en alles wat hem gebruikt:
       * GoalSheet, IdlePhase), alle 26 met een LEGE render als enige zichtbare symptoom.
       *
       * `pluginReactOptions.babel` is de doorgeefluik naar vite-plugin-rnw; gelezen in
       * node_modules/@storybook/react-native-web-vite/dist/preset.js, niet aangenomen.
       * De plugin hoort als laatste — zelfde eis als in babel.config.js.
       */
      pluginReactOptions: {
        babel: { plugins: ['react-native-worklets/plugin'] },
      },
    },
  },
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

    /**
     * Zet de exacte herkomst vlak vóór elke `StyleSheet.create`-aanroep.
     *
     * Zonder dit moet de aftap-module de herkomst uit een stacktrace afleiden, en die geeft
     * in een productiebundle alleen chunknamen — aantoonbaar fout: `workout.styles.ts` zit
     * alleen in de ActivePhase-chunk terwijl IdlePhase hem ook gebruikt, dus IdlePhase-nodes
     * zouden `ActivePhase` gaan heten.
     *
     * De komma-expressie laat `create` los van zijn ontvanger. Dat mag: `create` gebruikt
     * geen `this` (gelezen in react-native-web/dist/exports/StyleSheet/index.js). Alleen
     * app-code wordt aangeraakt — een aanroep uit node_modules zet de global niet, en de
     * wrapper wist hem na elke lezing, zodat RNW's eigen stijlen geen herkomst erven.
     */
    config.plugins.unshift({
      name: 'rowtrack-stylesheet-herkomst',
      enforce: 'pre',
      transform(code: string, id: string) {
        const pad = id.split('?')[0].replace(/\\/g, '/');
        if (pad.includes('/node_modules/') || !/\.(t|j)sx?$/.test(pad)) return null;
        if (!code.includes('StyleSheet.create(')) return null;
        const rel = pad.split('/apps/rowtrack/')[1] ?? pad;
        // De vervanging is lexicaal blind: hij raakt `StyleSheet.create(` óók in een string,
        // een comment of JSX-tekst. Dat is in deze codebase vandaag onschadelijk (nul
        // voorkomens buiten echte aanroepen), maar een documentatie-regel in een story zou
        // stil herschreven worden. Vandaar de telling: wijkt het aantal vervangingen af van
        // het aantal aanroepen dat een simpele haakjes-heuristiek verwacht, dan meldt de
        // build dat in plaats van het te verzwijgen.
        const aanroepen = code.match(/(?<![.\w'"`])StyleSheet\.create\(/g) ?? [];
        const ruw = code.match(/StyleSheet\.create\(/g) ?? [];
        if (ruw.length !== aanroepen.length)
          console.warn(`[rowtrack-stylesheet-herkomst] ${rel}: ${ruw.length - aanroepen.length}x `
            + '`StyleSheet.create(` staat in een string, comment of JSX-tekst en wordt NIET herschreven.');
        let i = 0;
        return {
          code: code.replace(/(?<![.\w'"`])StyleSheet\.create\(/g,
            () => (i++, `(globalThis.__RNW_SRC__=${JSON.stringify(rel)},StyleSheet.create)(`)),
          map: null,
        };
      },
    } as any);

    return config;
  },
};

export default config;
