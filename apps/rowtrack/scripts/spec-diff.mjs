#!/usr/bin/env node
/**
 * De poort per SNEDE: verandert deze refactor de gerenderde DOM?
 *
 * WAAROM `parity` HIER NIET VOLSTAAT. Die legt de browser naast FIGMA, en de twee schermen
 * staan sinds 2026-09-08 niet meer in de library — daar leest hij `~~ nieuw, nog niet gebouwd`.
 * En juist ín die schermen wordt gesneden. Een snede die een wrapper toevoegt of een gap
 * verliest is voor parity dus per constructie onzichtbaar, precies zoals vóór de recursie.
 *
 * WAT DEZE WEL MEET. Twee metingen van DEZELFDE browser: de bouwspec zoals hij in git staat
 * tegen de bouwspec op schijf. Beide komen uit Chromium, dus hier is BREEDTE wél vergelijkbaar
 * (bij parity niet — Figma's tekstengine meet anders) en tekst-hoogte ook. Dit is daarmee een
 * strengere toets dan parity, op precies het oppervlak waar parity blind is.
 *
 * Een DOM-neutrale snede geeft NUL verschillen. Een nieuw component bestaat nog niet in de
 * basislijn en is geen verschil maar `~~ nieuw`.
 *
 * Gebruik: node scripts/spec-diff.mjs [--basis=<git-ref>] [--alles] [--selftest]
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { echteKinderen, kindPad } from './spec-boom.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const vlag = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const BASIS = vlag('basis') ?? 'HEAD';
const ALLES = process.argv.includes('--alles');
const REL = 'figma/build-spec.min.json';

/** Dezelfde uitsluiting als parity: nodes die per meetmoment een andere maat hebben. */
const nrPad = join(APP, 'figma/niet-reproduceerbaar.json');
const nrData = existsSync(nrPad) ? JSON.parse(readFileSync(nrPad, 'utf8')) : null;
const nrKlassen = new Set(nrData?.klassen ?? []);
const nrPaden = new Set(nrData?.paden ?? []);
/** Uitgesloten als het PAD gemeten is, óf als een segment tot een gemeten KLASSE hoort. */
const instabiel = { has: (pad) => nrPaden.has(pad) || pad.split('>').some((seg) => nrKlassen.has(seg.replace(/^\d+:/, ''))) };

// Alles wat de vorm of de maat van een node bepaalt. Breedte en tekst-hoogte zitten er WEL in:
// beide kanten zijn dezelfde browser, dus een verschil is een echt verschil.
const VELDEN = ['w', 'h', 'gap', 'opacity', 'border', 'rij', 'justify', 'align', 'positie', 'slot'];
const gelijk = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function loop(a, b, pad, ctx) {
  if (instabiel.has(pad)) { ctx.instabiel++; return; }
  ctx.nodes++;
  for (const v of VELDEN) {
    ctx.velden++;
    if (!gelijk(a[v], b[v])) ctx.verschillen.push(`${pad} ${v}: ${JSON.stringify(a[v] ?? null)} -> ${JSON.stringify(b[v] ?? null)}`);
  }
  for (const [naam, sel] of [['padding', (n) => n.padding], ['radius', (n) => n.radius],
                             ['tekst', (n) => n.t?.s], ['achtergrond', (n) => !!n.bg || !!n.grad],
                             ['schaduw', (n) => !!n.schaduwStyle]]) {
    ctx.velden++;
    if (!gelijk(sel(a), sel(b))) ctx.verschillen.push(`${pad} ${naam}: ${JSON.stringify(sel(a) ?? null)} -> ${JSON.stringify(sel(b) ?? null)}`);
  }
  const ka = echteKinderen(a), kb = echteKinderen(b);
  ctx.velden++;
  if (ka.length !== kb.length) {
    ctx.verschillen.push(`${pad} kinderen: ${ka.length} -> ${kb.length}`);
    return;   // dieper vergelijken is dan betekenisloos: de indices lopen uit elkaar
  }
  for (let i = 0; i < ka.length; i++) loop(ka[i], kb[i], kindPad(pad, i, ka[i]), ctx);
}

function meet(oud, nieuw) {
  const ctx = { verschillen: [], nieuw: [], weg: [], gemeten: 0, nodes: 0, velden: 0, instabiel: 0 };
  for (const [soort, uit] of [['componenten', (d) => d.varianten], ['schermen', (d) => d.frames]]) {
    for (const [comp, d] of Object.entries(nieuw[soort] ?? {})) {
      const o = oud[soort]?.[comp];
      if (!o) { ctx.nieuw.push(`${comp} (${soort})`); continue; }
      const oudeV = Object.fromEntries(uit(o).map((v) => [v.naam, v]));
      for (const v of uit(d)) {
        const ov = oudeV[v.naam];
        if (!ov) { ctx.nieuw.push(`${comp}[${v.naam}]`); continue; }
        const bo = [ov.boom, ...(ov.overlays ?? [])], bn = [v.boom, ...(v.overlays ?? [])];
        if (bo.length !== bn.length)
          ctx.verschillen.push(`${comp}[${v.naam}] wrapper-kinderen: ${bo.length} -> ${bn.length}`);
        for (let i = 0; i < Math.min(bo.length, bn.length); i++)
          loop(bo[i], bn[i], i === 0 ? `${comp}[${v.naam}]` : `${comp}[${v.naam}]#overlay${i - 1}`, ctx);
        ctx.gemeten++;
      }
    }
    for (const comp of Object.keys(oud[soort] ?? {})) if (!nieuw[soort]?.[comp]) ctx.weg.push(`${comp} (${soort})`);
  }
  return ctx;
}

const nu = JSON.parse(readFileSync(join(APP, REL), 'utf8'));

if (process.argv.includes('--selftest')) {
  // TEGENPROEF. Een controle die groen blijft, en drie mutaties die elk rood moeten worden op
  // hún pad — een maat, een structuur, en een gap diep in een SCHERM, want dat is het oppervlak
  // waar parity blind is en waarvoor dit script bestaat.
  const kopie = () => JSON.parse(JSON.stringify(nu));
  const eersteScherm = Object.keys(nu.schermen ?? {})[0];
  const gevallen = [
    ['controle (ongemuteerd)', null],
    ['maat op een component', (x) => { x.componenten.Chip.varianten[0].boom.h += 3; }],
    ['extra kind in een component', (x) => { x.componenten.Chip.varianten[0].boom.k.push({ w: 1, h: 1, naam: 'nieuw' }); }],
    ['gap diep in een scherm', (x) => { const b = x.schermen[eersteScherm].frames[0].boom; b.k[0].gap = (b.k[0].gap ?? 0) + 7; }],
  ];
  let stuk = 0;
  for (const [label, muteer] of gevallen) {
    const x = kopie();
    if (muteer) muteer(x);
    const r = meet(nu, x);
    const goed = muteer ? r.verschillen.length > 0 : r.verschillen.length === 0;
    if (!goed) stuk++;
    console.log(`  ${goed ? 'ok  ' : 'FAAL'} ${label}: ${r.verschillen.length} verschil(len)`
      + (r.verschillen[0] ? ` — ${r.verschillen[0]}` : ` over ${r.nodes} nodes, ${r.velden} velden`));
  }
  console.log(stuk ? `\nzelftest: ${stuk} geval(len) stuk.`
    : '\nzelftest: groen zonder mutatie, rood op een maat, een structuur en een gap in een scherm.');
  process.exit(stuk ? 1 : 0);
}

let oudTekst;
try {
  oudTekst = execFileSync('git', ['show', `${BASIS}:apps/rowtrack/${REL}`], { cwd: APP, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch {
  console.error(`kan ${REL} niet uit ${BASIS} lezen — bestaat die ref, en staat het bestand erin?`);
  process.exit(2);
}
const r = meet(JSON.parse(oudTekst), nu);
console.log(`spec-diff — ${r.gemeten} varianten, ${r.nodes} nodes, ${r.velden} velden tegen ${BASIS}`);
console.log(`${r.instabiel} niet-reproduceerbare node(s) overgeslagen\n`);
if (r.nieuw.length) console.log(`${r.nieuw.length} nieuw sinds ${BASIS}: ${r.nieuw.join(', ')}\n`);
if (r.weg.length) console.log(`${r.weg.length} verdwenen sinds ${BASIS}: ${r.weg.join(', ')}\n`);
if (r.verschillen.length) {
  const max = ALLES ? Infinity : 40;
  for (const v of r.verschillen.slice(0, max)) console.log('  FAIL ' + v);
  if (r.verschillen.length > max) console.log(`  ... en ${r.verschillen.length - max} andere (draai met --alles)`);
  console.log(`\n${r.verschillen.length} verschil(len) in de gerenderde DOM. Een snede hoort er nul te geven.`);
  process.exit(1);
}
console.log('Geen verschil in de gerenderde DOM: maat, breedte, padding, radius, gap, opacity,');
console.log('richting, uitlijning, positie, tekstinhoud, achtergrond, schaduw en het aantal');
console.log('kinderen zijn op elke node gelijk aan de basislijn.');
