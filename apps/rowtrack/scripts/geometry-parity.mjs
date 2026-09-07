#!/usr/bin/env node
/**
 * De maat-as tussen Figma en de browser, per variant-node.
 *
 * `figma-sync-check.mjs` toetst namen, assen, tokenwaarden en typografie-herkomst. Geen van
 * die assen legt de twee RENDERS naast elkaar. Dit script doet dat.
 *
 * WAAROM DIT NIET TAUTOLOGISCH IS, ook al zijn de Figma-nodes uit de browser-meting gebouwd:
 * de builder transformeert. Auto-layout herberekent maten uit padding en kinderen,
 * `textAutoResize` verandert de tekstdoos, `strokeAlign: INSIDE` verschuift de rand naar
 * binnen. Elk van die drie kan een gebouwde node laten afwijken van het getal dat erin ging.
 * Deze as meet dus of de builder trouw schreef, niet of de spec klopte.
 *
 * DE JOIN-SLEUTEL is de variantnaam: Figma noemt een node `active=true`, en precies die
 * naam staat in figma/build-spec.json. Zonder die sleutel bestaat de koppeling niet.
 *
 * WAT ER VERGELEKEN WORDT: hoogte · breedte · horizontale padding · gap · radius ·
 * randbreedte · opacity · de AANWEZIGHEID van een vulling, rand en effect.
 *
 * WAT ER BEWUST BUITEN BLIJFT:
 *  · KLEUR en SCHADUWVORM — daarvoor is een beeldvergelijking nodig, en die is in Chromium
 *    geen identiteitstoets (AA-ruis, umanex-os LEARNINGS 2026-08-25). De aanwezigheid wordt
 *    wel getoetst: een getal dat niets tekent is anders ook een groene meting.
 *  · VERTICALE PADDING bij een vaste hoogte — die bepaalt de doos daar niet.
 *  · Alles wat de bouwspec afkapte (voorbij diepte 4 of 8 broers) — expliciet, zie het slot.
 *
 * Vereist figma/geometry.figma.json — het recept staat in apps/rowtrack/CLAUDE.md → Verify-pad.
 * Gebruik: node scripts/geometry-parity.mjs [--verbose]
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');
const figmaPad = join(APP, 'figma/geometry.figma.json');
if (!existsSync(figmaPad)) {
  console.error('geen figma/geometry.figma.json — lees hem uit met het recept in apps/rowtrack/CLAUDE.md → Verify-pad');
  process.exit(2);
}
const fig = JSON.parse(readFileSync(figmaPad, 'utf8'));
const spec = JSON.parse(readFileSync(join(APP, 'figma/build-spec.min.json'), 'utf8'));

// Tolerantie. Figma en Chromium ronden subpixels verschillend af; 0,5px is ruim genoeg voor
// die ruis en eng genoeg dat elke echte maatwijziging (de kleinste stap in de spacingschaal
// is 2px) er ruim doorheen komt.
const TOL = 0.5;
const dichtbij = (a, b) => a === null || b === null || Math.abs(a - b) <= TOL;

const verschillen = [], gemeten = [], ontbreekt = [];
let velden = 0;

for (const [comp, d] of Object.entries(spec.componenten)) {
  const fc = fig.componenten?.[comp];
  if (!fc) { ontbreekt.push(`${comp}: geen Figma-geometrie`); continue; }
  for (const v of d.varianten) {
    const fv = fc.varianten?.[v.naam];
    if (!fv) { ontbreekt.push(`${comp}[${v.naam}]: variant niet in Figma`); continue; }
    const b = v.boom;
    const paar = [
      ['hoogte', b.h, fv.h],
      ['breedte', b.w, fv.w],
      ['paddingLeft', b.padding?.[3] ?? 0, fv.paddingLeft ?? 0],
      ['paddingRight', b.padding?.[1] ?? 0, fv.paddingRight ?? 0],
      ['gap', b.gap ?? 0, fv.itemSpacing ?? 0],
      ['radius', b.radius?.[0] ?? 0, fv.radius ?? 0],
      ['randbreedte', b.border ?? 0, fv.strokeWeight ?? 0],
      ['opacity', b.opacity ?? 1, fv.opacity ?? 1],
    ];
    for (const [naam, browser, figma] of paar) {
      velden++;
      if (!dichtbij(browser, figma)) verschillen.push(`${comp}[${v.naam}] ${naam}: browser ${browser} tegen Figma ${figma}`);
    }
    // Aanwezigheid, niet gelijkheid: een rand die er is tegen een rand die er is.
    const aanwezig = [
      ['vulling', !!((b.bg && b.bg.a > 0) || b.grad), !!fv.heeftVulling],
      ['rand', (b.border ?? 0) > 0, !!fv.heeftRand],
      ['effect', !!b.schaduwStyle, !!fv.heeftEffect],
    ];
    for (const [naam, browser, figma] of aanwezig) {
      velden++;
      if (browser !== figma) verschillen.push(`${comp}[${v.naam}] ${naam}: browser ${browser ? 'wel' : 'niet'} tegen Figma ${figma ? 'wel' : 'niet'}`);
    }
    gemeten.push(`${comp}[${v.naam}]`);
  }
}

console.log(`geometry-parity — ${gemeten.length} variant-nodes, ${velden} velden vergeleken (tolerantie ${TOL}px)\n`);
if (ontbreekt.length) { console.log(`${ontbreekt.length} nodes zonder tegenhanger:`); for (const o of ontbreekt.slice(0, 15)) console.log('  ~~ ' + o); console.log(''); }
if (verschillen.length) {
  for (const v of verschillen.slice(0, 40)) console.log('  FAIL ' + v);
  if (verschillen.length > 40) console.log(`  ... en ${verschillen.length - 40} andere`);
  console.log(`\n${verschillen.length} verschil(len) tussen de Figma-node en de browser-render.`);
  process.exit(1);
}
if (VERBOSE) for (const g of gemeten) console.log('  ok ' + g);
console.log(`Geen verschil. Hoogte, breedte, horizontale padding, gap, radius, randbreedte,`);
console.log('opacity en de aanwezigheid van vulling/rand/effect komen op alle nodes overeen.');
console.log('Niet gemeten: kleurwaarde per node, schaduwvorm, icoonvorm, en alles wat de');
console.log('bouwspec afkapte (kinderen voorbij diepte 4 of voorbij 8 broers per niveau).');
if (ontbreekt.length) { console.log(`${ontbreekt.length} node(s) hadden geen tegenhanger — zie de ~~-regels.`); process.exit(1); }
