#!/usr/bin/env node
/**
 * Rendert ELKE story tegen een DRAAIENDE `storybook dev` en meldt per story: console-fouten,
 * pagefouten, en of er werkelijk iets in #storybook-root staat.
 *
 * De tegenhanger van `render-sweep.mjs`, en geen duplicaat ervan. Die meet `storybook-static`,
 * dus het BUILD-pad; dit meet het DEV-pad. Die twee lopen aantoonbaar uiteen, langs twee assen
 * die allebei op 2026-09-08 zijn opgemeten:
 *
 *   1. `__DEV__`. In de build staat die op false. `react-native-worklets` doet in
 *      `initializeRNRuntime()` een zelfcontrole achter `if (__DEV__)` (lib/module/initializers.js:106)
 *      en gooit `WorkletsError: Failed to create a worklet` wanneer zijn eigen broncode de
 *      babel-transform niet gehad heeft. De build ziet dat nooit.
 *   2. De dependency-optimizer. Die bestaat alleen in dev, bundelt met rolldown zonder babel,
 *      en zet `shimMissingExports` niet — waar het build-pad dat wel doet
 *      (vite-plugin-rnw/dist/index.mjs, `getBuildOptions` tegen `getOptimizeDepsOptions`).
 *
 * Gemeten stand van zaken die dag: `build-storybook` + `render:sweep` gaf 197/197 groen terwijl
 * `storybook dev` in dezelfde commit niet eens startte, en na de eerste fix nog vier componenten
 * blanco liet. Een groene render-sweep is dus geen uitspraak over dev.
 *
 * Gebruik:
 *   pnpm --filter rowtrack storybook          # in een andere terminal
 *   node scripts/dev-sweep.mjs [--poort 6007] [--verbose]
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const poort = Number(args[args.indexOf('--poort') + 1]) || 6007;
const basis = `http://localhost:${poort}`;

let index;
try {
  const rep = await fetch(`${basis}/index.json`);
  if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
  index = await rep.json();
} catch (e) {
  console.error(`geen draaiende Storybook op ${basis} (${e.message}) — start eerst \`pnpm --filter rowtrack storybook\``);
  process.exit(2);
}

const stories = Object.values(index.entries).filter((e) => e.type === 'story');
if (stories.length === 0) {
  console.error('index.json bevat nul stories — dat is een kapot instrument, geen groene meting');
  process.exit(2);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function meet(id) {
  const fouten = [];
  const onConsole = (m) => { if (m.type() === 'error') fouten.push('console: ' + m.text()); };
  const onError = (e) => fouten.push('pageerror: ' + e.message);
  page.on('console', onConsole);
  page.on('pageerror', onError);
  let vorm = { root: false, kinderen: 0, hoogte: 0 };
  try {
    await page.goto(`${basis}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(120);
    vorm = await page.evaluate(() => {
      const root = document.querySelector('#storybook-root');
      if (!root) return { root: false, kinderen: 0, hoogte: 0 };
      return { root: true, kinderen: root.childElementCount, hoogte: Math.round(root.getBoundingClientRect().height) };
    });
  } catch (e) {
    fouten.push('goto: ' + e.message.split('\n')[0]);
  }
  page.off('console', onConsole);
  page.off('pageerror', onError);
  return { vorm, fouten, ok: vorm.root && vorm.kinderen > 0 && vorm.hoogte > 0 && fouten.length === 0 };
}

const stuk = [];
let hertest = 0;

for (const s of stories) {
  let r = await meet(s.id);
  /*
   * Eén hertest, en die is geen vergoelijking. Bij een koude dep-cache ontdekt vite tijdens
   * de eerste paar story's nieuwe dependencies, heroptimaliseert en gooit een full reload —
   * midden in een `page.goto`. Gemeten 2026-09-08 op een koude start: precies 2 van 197
   * vielen zo om (een lege render en een goto-timeout), en dezelfde run tegen de inmiddels
   * warme server gaf 197/197. Een story die ook de tweede keer omvalt, blijft gewoon STUK —
   * en het aantal hertests staat in de uitvoer, zodat "warm gedraaid" niet stilletjes
   * "goedgepraat" kan worden.
   */
  if (!r.ok) {
    hertest++;
    r = await meet(s.id);
  }
  if (!r.ok) stuk.push({ id: s.id, ...r.vorm, fouten: r.fouten });
  if (VERBOSE) console.log(`${r.ok ? 'ok  ' : 'STUK'} ${s.id}`);
}

await browser.close();

console.log(`\ndev-sweep — ${stories.length} stories tegen de dev-server op :${poort}`);
if (hertest) console.log(`${hertest} story('s) eenmaal hertest na een reload tijdens het laden.`);
if (stuk.length === 0) {
  console.log(`alle ${stories.length} stories renderen: geen console-fout, geen lege render.`);
} else {
  console.log(`${stuk.length} van ${stories.length} STUK:`);
  for (const s of stuk) {
    console.log(`  ${s.id} — kinderen=${s.kinderen} hoogte=${s.hoogte}`);
    for (const f of s.fouten) console.log(`      ${f.slice(0, 300)}`);
  }
}
process.exit(stuk.length ? 1 : 0);
