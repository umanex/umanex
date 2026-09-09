import { transformAsync } from '@babel/core';
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
  // expo-router is geen bestand in deze repo maar een pakket; de staart van zijn opgeloste
  // entry is stabiel genoeg om op te matchen, en de rest van de regel hierboven geldt ook hier.
  '/expo-router/build/index.js': './mocks/expo-router.tsx',
  '/expo-router/entry.js': './mocks/expo-router.tsx',
};

/**
 * expo-modules-core@3.0.30 levert TypeScript-BRON uit, geen build: zijn package.json
 * zet `"main": "src/index.ts"` en `exports["."].default = "./src/index.ts"`. In die bron
 * zit één bestand dat een bundler laat struikelen — `src/ts-declarations/global.ts`:
 *
 *   import { EventEmitter } from './EventEmitter';   // <- geen `type`-modifier
 *   declare namespace ExpoGlobal { export { EventEmitter } }
 *
 * `EventEmitter.ts` bevat alleen `export declare class` — ambient, dus nul runtime-export.
 * Het `export { EventEmitter }` binnen de `declare namespace` laat oxc de import als
 * WAARDE-verwijzing lezen, waardoor hij hem niet elideert; rolldown faalt daarna link-time
 * met `[MISSING_EXPORT] "EventEmitter" is not exported by …/ts-declarations/EventEmitter.ts`.
 * esbuild (vite 7 en eerder) gooide die import gewoon weg, vandaar dat dit pas met vite 8
 * opduikt. Metro/babel raakt het niet — de app zelf bouwt gewoon door; dit is uitsluitend
 * het web-renderpad van Storybook.
 *
 * Het bestand komt in de graaf via een WAARDE-keten, niet via types:
 *   src/index.ts → './polyfill' → src/polyfill/dangerous-internal.ts
 *   → `export * from '../ts-declarations/global'`  (géén `export type *`)
 *
 * De vervanging is geen benadering maar de juiste compilatie: `ts.transpileModule` geeft
 * voor alle vijf `.ts`-bestanden in die map exact `export {};` (gemeten 2026-09-08 met de
 * TypeScript 5.9.3 uit deze repo; ter tegenproef gaf hetzelfde script voor
 * `src/EventEmitter.ts` 191 tekens en voor `src/index.ts` 959). We leveren dus af wat
 * `tsc` zou afleveren.
 *
 * De plugin moet TWEE keer geregistreerd worden. `config.plugins` dekt de dev- en
 * build-pipeline; de dependency-optimizer bouwt zijn plugin-lijst uitsluitend uit
 * `optimizeDeps.rolldownOptions.plugins` — gelezen in
 * de geinstalleerde vite 8.2.2, dist/node/chunks/node.js regel 32349 en 32368
 * (`const { plugins: pluginsFromConfig = [] } = optimizeDeps.rolldownOptions ?? {}`),
 * niet aangenomen. Alleen `config.plugins` laat de optimizer-crash dus staan.
 *
 * Waarom `storybook build` hier nooit over viel: vite-plugin-rnw zet in `getBuildOptions()`
 * `shimMissingExports: true` en in `getOptimizeDepsOptions()` niet (dist/index.mjs, regels
 * 262-286). Dezelfde graaf overleeft dus de build en valt om in dev. Die vlag ook in de
 * optimizer zetten zou een kortere fix zijn, maar hij shimt ELKE ontbrekende export naar
 * `undefined` — ook een echte. Deze stub raakt vijf bestanden waarvan `tsc` bewijst dat ze
 * niets exporteren, en laat de volgende echte MISSING_EXPORT gewoon afgaan.
 */

/**
 * Modules die vervangen worden door hun eigen, correcte lege of triviale uitkomst.
 *
 * Geen aliassen op import-specifiers maar een match op het OPGELOSTE pad, om dezelfde
 * reden als bij MOCKS hierboven: dan doet de vorm van de import niet meer ter zake.
 */
const STUBS: { test: RegExp; code: string }[] = [
  // expo-modules-core: zie de uitleg hierboven. De `(?<!\.d)` sluit de drie `.d.ts`-bestanden
  // in dezelfde map uit — die worden nooit als module geladen, dus ze horen niet in het bereik
  // van iets dat modules vervangt. Wat overblijft zijn exact de vijf `.ts`-bestanden waarvan
  // `ts.transpileModule` (TypeScript 5.9.3 uit deze repo) `export {};` maakt. De regex ankert
  // op het pad-segment `ts-declarations/` en niet op de basename: `src/EventEmitter.ts` en
  // `src/NativeModule.ts` een map hoger dragen wél echte runtime-code en blijven ongemoeid.
  { test: /\/expo-modules-core\/src\/ts-declarations\/[^/]+(?<!\.d)\.ts$/, code: 'export {}' },
];

const stubPlugin = {
  name: 'rowtrack-node-only-stubs',
  enforce: 'pre' as const,
  load(id: string) {
    const pad = id.split('?')[0].replace(/\\/g, '/');
    return STUBS.find((s) => s.test.test(pad))?.code ?? null;
  },
};

/**
 * Draait `react-native-worklets/plugin` over Reanimated en Worklets BINNEN de
 * dependency-optimizer.
 *
 * Dit is de enige plek waar die transform gebeurt, en dat is geen keuze maar een meting.
 * vite-plugin-rnw sluit babel standaard uit met
 * `/\/node_modules\/(?!react-native|@react-native|expo|@expo)/` (dist/index.mjs:239). Die
 * lookahead veronderstelt een gehoiste boom; onder pnpm staat `.pnpm/` achter het eerste
 * `/node_modules/`, de lookahead slaagt daar, en netto slaat babel dus ALLES in node_modules
 * over — ook deze twee pakketten. Nagemeten 2026-09-09: het pad van
 * `react-native-worklets/lib/module/initializers.js` matcht die regex (uitgesloten), dat van
 * `components/WheelPicker.tsx` niet (wordt wel getransformeerd). De worklets van de app zelf
 * krijgen hun transform dus gewoon via `pluginReactOptions.babel`; die van de twee pakketten
 * krijgen hem hier, en nergens anders.
 *
 * De optimizer bundelt met rolldown en kent geen babel — en
 * `react-native-worklets/lib/module/initializers.js:106` doet in `initializeRNRuntime()` een
 * zelfcontrole achter `if (__DEV__)`: hij maakt een `'worklet'`-functie en gooit
 * `WorkletsError: Failed to create a worklet` als die geen worklet blijkt. Zonder deze plugin
 * renderden op 2026-09-08 vier componenten leeg in dev terwijl `storybook build` 197/197 gaf,
 * want daar is `__DEV__` onwaar en slaat de controle over. Diezelfde asymmetrie verklaart
 * waarom de build ook zónder babel over deze pakketten groen blijft.
 *
 * De plugin hoort in `optimizeDeps.rolldownOptions.plugins`; de optimizer bouwt zijn
 * plugin-lijst uitsluitend daaruit en niet uit `config.plugins` (gelezen in de geinstalleerde
 * vite 8.2.2, dist/node/chunks/node.js regel 32349 en 32368).
 *
 * `disableSourceMaps` staat aan omdat de plugin anders per worklet de bronbestanden van de
 * input-sourcemap van schijf leest (`fs.readFileSync`, plugin/index.js:697). In een pre-bundle
 * heeft die sourcemap geen waarde en de lezing kost alleen tijd.
 */
const WORKLET_PAKKETTEN = /\/node_modules\/react-native-(?:worklets|reanimated)\//;

const workletsInOptimizer = {
  name: 'rowtrack-worklets-in-optimizer',
  async transform(code: string, id: string) {
    const pad = id.split('?')[0].replace(/\\/g, '/');
    if (!WORKLET_PAKKETTEN.test(pad)) return null;
    // Alleen JS/TS. De extensie-check is niet overbodig naast het woordfilter hieronder:
    // `react-native-worklets/package.json` en `react-native-reanimated/compatibility.json`
    // dragen het woord "worklet" allebei, en babel gooit daarop `Missing semicolon` — gemeten
    // 2026-09-09, twee bestanden, de optimizer viel er hard op om.
    if (!/\.[cm]?[jt]sx?$/.test(pad)) return null;
    // Snelfilter: babel over de hele twee pakketten halen kost seconden, en alleen bestanden
    // die het woord dragen kunnen een worklet bevatten.
    if (!code.includes('worklet')) return null;
    const uit = await transformAsync(code, {
      filename: pad,
      babelrc: false,
      configFile: false,
      sourceMaps: false,
      parserOpts: { plugins: ['jsx'] },
      plugins: [['react-native-worklets/plugin', { disableSourceMaps: true }]],
    });
    return uit?.code ? { code: uit.code, map: null } : null;
  },
};

const config: StorybookConfig = {
  // `app/` staat erbij sinds fase 1 van de schermen-briefing: de zeven route-schermen krijgen
  // een story zodat ze een render-pad hebben. Ze zijn SCHERMEN, geen componenten — ze staan in
  // `scripts/schermen.mjs` en worden daarmee uitgesloten van de library-assen.
  stories: ['../docs/**/*.mdx', '../components/**/*.stories.@(ts|tsx)', '../app/**/*.stories.@(ts|tsx)'],
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
    config.plugins.unshift(stubPlugin as any);

    // Tweede registratie: de dependency-optimizer leest `config.plugins` niet.
    config.optimizeDeps ??= {};
    (config.optimizeDeps as any).rolldownOptions ??= {};
    (config.optimizeDeps as any).rolldownOptions.plugins ??= [];
    (config.optimizeDeps as any).rolldownOptions.plugins.push(stubPlugin);
    (config.optimizeDeps as any).rolldownOptions.plugins.push(workletsInOptimizer);


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
