#!/usr/bin/env node
/**
 * Tegenproef voor lib/guardRules.mjs — beide kanten van beide regels.
 *
 * Waarom dit bestaat: de enige app die vandaag onder PM2 draait is cashflow, en zijn
 * server is een productiebuild op :3000. De "guard zwijgt"-kant meten door
 * `pm2 stop cashflow` te doen zou die server platleggen. Dus draait de regel hier op
 * synthetische PM2- en branch-staat, mét de échte scripttekst uit de package.json
 * van de app — de helft die wél uit de werkelijkheid moet komen.
 *
 * De tabel mengt bewust "blokkeert" en "vrij". Geven alle regels dezelfde uitkomst,
 * dan meet deze opstelling het defect niet en is dat de bevinding, geen bevestiging.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blokkade, commandoTekst } from '../lib/guardRules.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const appsDir = join(hier, '../../');

const scriptsVan = (id) => JSON.parse(readFileSync(join(appsDir, id, 'package.json'), 'utf8')).scripts ?? {};

const START = { cashflow: 'pnpm dev', portfolio: 'pnpm dev', rowtrack: 'npx expo start --dev-client' };

/** [app, knop, pm2Naam, branch, moetBlokkeren, waarom deze regel er staat] */
const GEVALLEN = [
  ['cashflow',  'start', 'cashflow',  'feature/x', true,  'regel 1 vuurt: dev wist .next onder de PM2-server'],
  ['cashflow',  'start', null,        'feature/x', false, 'regel 1 zwijgt zonder PM2 — de kant die productie nooit toont'],
  ['cashflow',  'build', 'cashflow',  'feature/x', true,  'regel 2 vuurt: next build op een feature branch'],
  ['cashflow',  'build', 'cashflow',  'main',      false, 'regel 2 zwijgt op main — de branch-conditie doet echt iets'],
  ['portfolio', 'start', 'portfolio', 'feature/x', false, 'regel 1 keert op de scripttekst, niet op de appnaam'],
  ['portfolio', 'build', 'portfolio', 'feature/x', true,  'regel 2 is app-agnostisch, niet aan cashflow vastgeknoopt'],
  ['rowtrack',  'start', null,        'feature/x', false, 'expo raakt geen van beide regels'],
];

const fouten = [];

// Rail: laat het instrument het object éérst terugvinden. Blokkeert regel 1 omdat
// `pnpm dev` correct oploste naar de dev-tekst, of omdat er toevallig iets matchte?
const cashflowStart = commandoTekst(scriptsVan('cashflow'), START.cashflow, 'start');
if (!/rm\s+-rf\s+\S*\.next/.test(cashflowStart)) {
  fouten.push(`commandoTekst loste 'pnpm dev' niet op naar cashflow's dev-script — kreeg: ${cashflowStart}`);
}

for (const [app, knop, pm2Naam, branch, moetBlokkeren, waarom] of GEVALLEN) {
  const tekst = commandoTekst(scriptsVan(app), START[app] ?? '', knop);
  const reden = blokkade(tekst, { pm2Naam, branch });
  const geblokkeerd = reden !== null;
  const status = geblokkeerd === moetBlokkeren ? 'ok  ' : 'FAIL';
  if (geblokkeerd !== moetBlokkeren) {
    fouten.push(`${app}/${knop} (pm2=${pm2Naam}, branch=${branch}): verwacht ${moetBlokkeren ? 'blokkade' : 'vrij'}, kreeg ${geblokkeerd ? `blokkade "${reden}"` : 'vrij'}`);
  }
  console.log(`  ${status} ${app}/${knop} → ${geblokkeerd ? 'blokkeert' : 'vrij'} — ${waarom}`);
}

// Een tabel die maar één uitkomst kent, kan het defect niet opwekken.
const uitkomsten = new Set(GEVALLEN.map((g) => g[4]));
if (uitkomsten.size < 2) fouten.push('alle gevallen verwachten dezelfde uitkomst — deze opstelling toetst niets');

console.log('');
if (fouten.length) {
  for (const f of fouten) console.error(`  FOUT ${f}`);
  process.exit(1);
}
console.log(`${GEVALLEN.length} gevallen groen — beide regels vuren én zwijgen, op echte scripttekst.`);
