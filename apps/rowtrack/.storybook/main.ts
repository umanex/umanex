import { createRequire } from 'node:module';
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

const require_ = createRequire(import.meta.url);

/**
 * De compatibiliteitscheck van Reanimated draait hier, in Node, en niet in de browser.
 *
 * `react-native-reanimated/scripts/validate-worklets-version` is CommonJS en doet
 * `require('react-native-worklets/package.json')`. Zodra `react-native-worklets` in
 * `optimizeDeps.exclude` staat (nodig, zie verderop) markeert vite hem als external — en die
 * markering dekt ook zijn subpaden, dus de `require` blijft als runtime-aanroep in de bundel
 * staan. In een browser bestaat `require` niet; de validator vangt zijn eigen fout af en meldt
 * `react-native-worklets package isn't installed` over een package dat gewoon geinstalleerd is.
 * Gemeten 2026-09-08 met de dev-sweep: 55 van 197 stories leeg, alle 55 op deze melding.
 *
 * De check zelf is zinvol, alleen zijn plaats klopte niet. Hier draait hij waar `require` werkt
 * en faalt hij hard bij het starten van Storybook, in plaats van als lege render.
 *
 * Waarom dit met een enkele story onzichtbaar bleef: het zijn juist de componenten die
 * Reanimated gebruiken die omvallen, en de optimizer beslist per run wanneer hij reanimated
 * bundelt. Een probe over vier stories gaf hier 4/4 groen terwijl de volle sweep 55 rood gaf.
 * Toets deze rail dus met `node scripts/dev-sweep.mjs`, nooit met een handvol stories.
 */
const reanimatedVersie = require_('react-native-reanimated/package.json').version as string;
const versieUitslag = require_('react-native-reanimated/scripts/validate-worklets-version')(
  reanimatedVersie,
) as { ok: boolean; message?: string };
if (!versieUitslag.ok) throw new Error(`[rowtrack-storybook] ${versieUitslag.message}`);

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
  // reanimated: de versiecheck is hierboven al in Node gedraaid en geslaagd. In de browser kan
  // hij per constructie niet draaien, dus hij levert daar alleen een valse negatieve.
  {
    test: /\/react-native-reanimated\/scripts\/validate-worklets-version\.js$/,
    code: 'export default function validateWorkletsVersion() { return { ok: true }; }',
  },
];

const stubPlugin = {
  name: 'rowtrack-node-only-stubs',
  enforce: 'pre' as const,
  load(id: string) {
    const pad = id.split('?')[0].replace(/\\/g, '/');
    return STUBS.find((s) => s.test.test(pad))?.code ?? null;
  },
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
        babel: {
          /**
           * `disableSourceMaps` is niet cosmetisch: zonder die vlag leest de plugin voor
           * elke worklet de bronbestanden van de input-sourcemap terug van schijf
           * (`fs.readFileSync(sourceFile)`, plugin/index.js:697, achter
           * `!(isRelease() || state.opts.disableSourceMaps)`). Vite geeft een dep die niet
           * pre-gebundeld is een `?v=<hash>`-query mee in zijn id, en die query komt
           * ongewijzigd in `sources` terecht — de lezing valt dan om met
           * `ENOENT … initializers.js?v=4cf170a1`. In de productie-build speelt dat niet,
           * want daar is `isRelease()` al waar; dit raakt alleen dev.
           *
           * Per bestand schakelen kan niet: plugin-react accepteert `babel` óók als
           * functie `(id) => BabelOptions` (dist/index.js:179), maar de Storybook-preset
           * spreidt hem altijd in een object (`babel: { babelrc: false, configFile: false,
           * ...pluginReactOptions.babel }` in preset.js) en een functie heeft geen eigen
           * enumerable properties — hij zou stil leegvallen. Vandaar globaal, met als prijs
           * dat een stacktrace bínnen een worklet in dev niet naar de bron wijst.
           */
          plugins: [['react-native-worklets/plugin', { disableSourceMaps: true }]],
        },
        /**
         * Zonder deze regel raakt babel — en dus de worklets-plugin hierboven — de
         * broncode van Reanimated en Worklets NIET, en dat is een pnpm-artefact.
         *
         * vite-plugin-rnw sluit standaard uit met
         * `/\/node_modules\/(?!react-native|@react-native|expo|@expo)/`
         * (dist/index.mjs:239). Die lookahead veronderstelt een gehoiste boom
         * (`node_modules/react-native-worklets/...`). Onder pnpm is het echte pad
         * `node_modules/.pnpm/react-native-worklets@0.5.1_…/node_modules/react-native-worklets/…`,
         * en de regex is niet verankerd: hij vindt het eerste `/node_modules/`, ziet daar
         * `.pnpm/` staan, de lookahead slaagt en het bestand wordt uitgesloten. Netto sluit
         * de default onder pnpm dus ALLES in node_modules uit — ook react-native en expo.
         *
         * Gevolg, gemeten 2026-09-08: `react-native-worklets/lib/module/initializers.js:106`
         * doet in `initializeRNRuntime()` een zelfcontrole — hij maakt een `'worklet'`-functie
         * en gooit `WorkletsError` als die geen worklet blijkt. Die controle staat achter
         * `if (__DEV__)`. Vandaar dat `storybook build` groen is (197/197 in render-sweep) en
         * `storybook dev` niet: dezelfde code, andere vlag.
         *
         * De vervangende regex slaat het eerste `/node_modules/` over wanneer daar `.pnpm/`
         * op volgt, en laat alleen reanimated en worklets door babel. Getoetst tegen zeven
         * echte paden: rn-web, react-native en lodash blijven uitgesloten zoals vandaag,
         * app-code blijft binnen, en een gehoiste boom verandert niet.
         */
        exclude: /\/node_modules\/(?!\.pnpm\/)(?!react-native-worklets\/|react-native-reanimated\/)/,
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

    /**
     * `react-native-worklets` mag NIET door de dependency-optimizer, `react-native-reanimated`
     * juist WEL. Die asymmetrie is gemeten, niet gekozen.
     *
     * Worklets eruit: zijn `initializeRNRuntime()` doet een zelfcontrole — hij maakt een
     * `'worklet'`-functie en gooit `WorkletsError: Failed to create a worklet` als die geen
     * worklet blijkt (lib/module/initializers.js:106, achter `if (__DEV__)`). Die controle
     * slaagt alleen als `react-native-worklets/plugin` over zijn eigen broncode is gegaan, en
     * de optimizer bundelt met rolldown zonder babel. Uit de optimizer gehaald loopt het
     * bestand door de normale pipeline en krijgt het babel wel. Gemeten 2026-09-08: zonder
     * dit renderden WheelPicker, GoalSheet, ActivePhase en IdlePhase leeg in dev.
     *
     * Reanimated erin: hij importeert `react-native-reanimated/scripts/validate-worklets-version`,
     * een CommonJS-bestand (`module.exports = validateVersion`) dat vanuit zijn ESM-build als
     * default wordt geimporteerd. Alleen de optimizer geeft zo'n bestand CJS-interop. Sluit je
     * reanimated ook uit, dan valt de story om op
     * `SyntaxError: … validate-worklets-version.js does not provide an export named 'default'`
     * — gemeten 2026-09-08, en opnieuw gemeten nadat de rest van de fix stond. Reanimateds
     * eigen worklets hebben babel niet nodig; met alleen worklets uitgesloten rendert de volle
     * dev-sweep schoon. De prijs van die asymmetrie is de versiecheck hierboven, die door de
     * external-markering van worklets zijn `require` niet meer opgelost krijgt.
     *
     * `storybook build` heeft aan beide kanten geen last: daar is `__DEV__` onwaar en wordt
     * alles gebundeld. Dat is precies waarom `build-storybook` + `render:sweep` dit gat niet
     * kon zien — 197/197 groen terwijl dev vier componenten blanco liet.
     */
    config.optimizeDeps.exclude = [
      ...(config.optimizeDeps.exclude ?? []),
      'react-native-worklets',
    ];

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
