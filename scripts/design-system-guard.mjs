#!/usr/bin/env node
/**
 * design-system-guard.mjs — dwingt af dat elke app zijn design-systeem-bron expliciet
 * declareert, en dat die declaratie klopt met wat er op schijf staat.
 *
 * Waarom een guard en geen instructie: de componentlaag `@umanex/ui` bestond al maanden
 * mét Storybook, mét Figma-sync en mét een CI-build, terwijl cashflow — het grootste
 * UI-oppervlak van de monorepo — hem in nul app-bestanden importeerde. De dependency
 * stond in package.json, de enige gebruiker was een render-script. Storybook maakt de
 * laag zichtbaar; hij maakt hem niet gebruikt. Dat verschil is precies wat hier gemeten
 * wordt.
 *
 * De sectie is het contract. In `apps/<app>/CLAUDE.md`:
 *
 *   ## Design-systeem-bron
 *
 *   - **Preset:** `@umanex/config/tailwind/preset`
 *   - **Componentbron:** `@umanex/ui`
 *   - **Storybook:** `pnpm --filter @umanex/ui storybook` (:6006)
 *
 * "geen" is overal een geldig antwoord, mits het er staat — een lege regel laat de vraag
 * terugkomen, het woord "geen" maakt de keuze telbaar. Zelfde regime als `## Verify-pad`.
 *
 * Vijf assen:
 *   [sectie]    de sectie bestaat in elke app-CLAUDE.md
 *   [velden]    Preset, Componentbron en Storybook zijn alle drie ingevuld
 *   [preset]    de gedeclareerde preset is de preset die tailwind.config echt importeert
 *   [dubbel]    een app op `@umanex/ui` heeft geen lokale kopie van een van zijn exports
 *   [adoptie]   een app op `@umanex/ui` importeert hem ook echt, in app-code
 *
 * De [adoptie]-as telt scripts/ NIET mee: een render-harness die de primitives importeert
 * bewijst niets over de app die de gebruiker ziet.
 *
 * Tegenproef: scripts/design-system-selftest.mjs — per as het defect, plus de zwijg-kant.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDefault = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootArg = process.argv.find(a => a.startsWith('--root='));
const ROOT = rootArg ? rootArg.slice('--root='.length) : repoDefault;

const APPS_DIR = join(ROOT, 'apps');
const UI_PKG = join(ROOT, 'packages/ui/package.json');
const SECTIE = '## Design-systeem-bron';
const VELDEN = ['Preset', 'Componentbron', 'Storybook'];
/**
 * De mappen die app-code dragen. Bewust een toelatingslijst en geen uitsluitlijst: bij
 * een uitsluitlijst telde `next.config.mjs` mee, die `@umanex/ui` in `transpilePackages`
 * noemt zonder er één component uit te renderen — de guard stond groen op precies de app
 * waarvoor hij gebouwd was. Het meetbereik bevatte de meting zelf.
 */
const APPCODE_MAPPEN = ['app', 'src', 'components', 'lib', 'hooks', 'features', 'ui', 'pages'];
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

const bevindingen = [];
const meld = (as, app, tekst, herstel) => bevindingen.push({ as, app, tekst, herstel });

const lees = p => readFileSync(p, 'utf8');
/** Strip backticks en witruimte; normaliseer "geen — reden" naar "geen". */
const waarde = s => s.replace(/`/g, '').trim();
const isGeen = s => /^geen\b/i.test(waarde(s));

/** De sectie uit een CLAUDE.md: alles tussen de kop en de volgende `## `. */
function sectieVan(md) {
  const regels = md.split('\n');
  const start = regels.findIndex(r => r.trim() === SECTIE);
  if (start === -1) return null;
  const rest = regels.slice(start + 1);
  const eind = rest.findIndex(r => /^## /.test(r));
  return (eind === -1 ? rest : rest.slice(0, eind)).join('\n');
}

/** `- **Preset:** <waarde>` → <waarde>, of null als het veld ontbreekt. */
function veldVan(sectie, naam) {
  const m = sectie.match(new RegExp(`^-\\s+\\*\\*${naam}:\\*\\*\\s*(.*)$`, 'm'));
  const v = m ? m[1].trim() : null;
  return v ? v : null;
}

/** Welke preset importeert tailwind.config écht? null = geen config, '' = config zonder preset. */
function echtePreset(appDir) {
  const config = ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.cjs']
    .map(n => join(appDir, n)).find(existsSync);
  if (!config) return null;
  const bron = lees(config);
  // Alleen echte import-regels; een comment die de preset noemt telt niet mee.
  const specs = [...bron.matchAll(/^\s*import\s+[^;'"]*from\s+['"]([^'"]+)['"]/gm)].map(m => m[1]);
  const presets = specs.filter(s => /(^|\/)preset$|tailwind\/preset/.test(s));
  return presets.length ? presets[0] : '';
}

/** Elk broncodebestand onder de toegelaten app-mappen. */
function appCodeBestanden(appDir) {
  const uit = [];
  const loop = dir => {
    let items;
    try { items = readdirSync(dir); } catch { return; }
    for (const naam of items) {
      if (naam.startsWith('.') || naam === 'node_modules') continue;
      const pad = join(dir, naam);
      let st;
      try { st = statSync(pad); } catch { continue; }
      if (st.isDirectory()) loop(pad);
      else if (CODE_EXT.has(extname(naam))) uit.push(pad);
    }
  };
  for (const map of APPCODE_MAPPEN) {
    const dir = join(appDir, map);
    if (existsSync(dir)) loop(dir);
  }
  return uit;
}

/**
 * Importeert dit bestand de package echt? Een naam in een config-array of een comment is
 * een vermelding, geen gebruik — daarom het import-/require-specifier-patroon en niet een
 * kale substring.
 */
const IMPORTEERT = /(?:from|import|require)\s*\(?\s*['"]@umanex\/ui(?:\/[^'"]*)?['"]/;

/** De primitives die @umanex/ui exporteert, op basisnaam: button, input, card, … */
function uiExports() {
  if (!existsSync(UI_PKG)) return new Set();
  const pkg = JSON.parse(lees(UI_PKG));
  const namen = Object.keys(pkg.exports ?? {})
    .filter(k => k.startsWith('./components/'))
    .map(k => basename(k).toLowerCase());
  return new Set(namen);
}

/** Lokale ui/-componenten van een app, op basisnaam zonder extensie. */
function lokaleUiComponenten(appDir) {
  const uit = new Map();
  for (const sub of ['components/ui', 'src/components/ui']) {
    const dir = join(appDir, sub);
    if (!existsSync(dir)) continue;
    for (const naam of readdirSync(dir)) {
      if (!CODE_EXT.has(extname(naam))) continue;
      uit.set(basename(naam, extname(naam)).toLowerCase(), join(sub, naam));
    }
  }
  return uit;
}

// ── de run ───────────────────────────────────────────────────────────────────
if (!existsSync(APPS_DIR)) {
  console.error(`✗ Geen apps/ onder ${ROOT} — niets te toetsen.`);
  process.exit(1);
}

const apps = readdirSync(APPS_DIR).filter(n => statSync(join(APPS_DIR, n)).isDirectory()).sort();
const exports_ = uiExports();
let getoetst = 0;

for (const app of apps) {
  const appDir = join(APPS_DIR, app);
  const md = join(appDir, 'CLAUDE.md');

  if (!existsSync(md)) {
    meld('[sectie]', app, 'geen CLAUDE.md, dus geen design-systeem-bron.',
      `Maak apps/${app}/CLAUDE.md met een "${SECTIE}"-sectie.`);
    continue;
  }

  const sectie = sectieVan(lees(md));
  if (sectie === null) {
    meld('[sectie]', app, `geen "${SECTIE}"-sectie in CLAUDE.md.`,
      `Voeg de sectie toe met de velden ${VELDEN.join(', ')}. "geen" is een geldig antwoord.`);
    continue;
  }
  getoetst++;

  const velden = Object.fromEntries(VELDEN.map(v => [v, veldVan(sectie, v)]));
  const ontbreekt = VELDEN.filter(v => !velden[v]);
  if (ontbreekt.length) {
    meld('[velden]', app, `veld ontbreekt of is leeg: ${ontbreekt.join(', ')}.`,
      `Schrijf per veld een regel: - **<veld>:** <waarde>. "geen" mag, leeg niet.`);
    continue;
  }

  // [preset] — de declaratie moet de werkelijkheid zijn, niet een herinnering eraan.
  const echt = echtePreset(appDir);
  const gedeclareerd = waarde(velden.Preset);
  if (echt === null) {
    if (!isGeen(gedeclareerd)) {
      meld('[preset]', app, `declareert preset \`${gedeclareerd}\`, maar er is geen tailwind.config.`,
        `Zet "geen — <reden>" als deze app geen Tailwind gebruikt.`);
    }
  } else if (echt === '') {
    if (!isGeen(gedeclareerd)) {
      meld('[preset]', app, `declareert preset \`${gedeclareerd}\`, maar tailwind.config importeert er geen.`,
        `Zet "geen — <reden>", of importeer de preset in tailwind.config.`);
    }
  } else if (isGeen(gedeclareerd)) {
    meld('[preset]', app, `declareert "geen", maar tailwind.config importeert \`${echt}\`.`,
      `Zet \`${echt}\` als Preset.`);
  } else if (gedeclareerd !== echt) {
    meld('[preset]', app, `declareert \`${gedeclareerd}\`, tailwind.config importeert \`${echt}\`.`,
      `Maak de sectie gelijk aan de config, of andersom.`);
  }

  const bron = waarde(velden.Componentbron);
  const pkgPad = join(appDir, 'package.json');
  const pkg = existsSync(pkgPad) ? JSON.parse(lees(pkgPad)) : {};
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const heeftDep = Boolean(deps['@umanex/ui']);

  if (bron === '@umanex/ui' && !heeftDep) {
    meld('[adoptie]', app, 'declareert @umanex/ui als componentbron, maar heeft hem niet als dependency.',
      `Voeg "@umanex/ui": "workspace:*" toe aan apps/${app}/package.json.`);
  }

  // [dubbel] — een lokale kopie van een primitive die de package al levert. Alleen voor
  // apps die zeggen op die package te draaien: vyvey dubbelt Button bewust, op een eigen
  // thema, en dat staat in zijn sectie.
  if (bron === '@umanex/ui') {
    for (const [naam, pad] of lokaleUiComponenten(appDir)) {
      if (exports_.has(naam)) {
        meld('[dubbel]', app, `${pad} dubbelt de export \`@umanex/ui/components/ui/${naam}\`.`,
          `Importeer de gedeelde versie, of zet Componentbron op "eigen" met een reden.`);
      }
    }
  }

  // [adoptie] — de dependency is een intentie, de import is het bewijs. Deze as draait
  // ook wanneer de sectie iets ánders declareert: een workspace-dependency die geen
  // enkel app-bestand aanraakt is dood gewicht dat als adoptie leest. Precies de vorm
  // waarin cashflow @umanex/ui maandenlang "gebruikte" — dependency aanwezig, enige
  // importeur een render-script.
  if (bron === '@umanex/ui' || heeftDep) {
    const gebruikers = appCodeBestanden(appDir).filter(p => IMPORTEERT.test(lees(p)));
    if (!gebruikers.length) {
      const tekst = bron === '@umanex/ui'
        ? 'declareert @umanex/ui, maar geen enkel app-bestand importeert hem.'
        : `draagt @umanex/ui als dependency terwijl Componentbron "${bron}" zegt, en geen app-bestand importeert hem.`;
      meld('[adoptie]', app, tekst,
        `Bouw de app-componenten op de gedeelde primitives, of haal de dependency weg. scripts/ telt niet mee.`);
    }
  }
}

// ── rapport ──────────────────────────────────────────────────────────────────
if (!bevindingen.length) {
  console.log(`✓ Design-systeem-bron: ${getoetst}/${apps.length} apps gedeclareerd en in lijn met de schijf.`);
  process.exit(0);
}

console.error(`✗ Design-systeem-bron — ${bevindingen.length} bevinding(en) over ${apps.length} apps:\n`);
for (const b of bevindingen) {
  console.error(`  ${b.as} ${b.app}: ${b.tekst}`);
  console.error(`      → ${b.herstel}`);
}
console.error(`\n  Het contract staat in CLAUDE.md → Design-systeem-bron.`);
process.exit(1);
