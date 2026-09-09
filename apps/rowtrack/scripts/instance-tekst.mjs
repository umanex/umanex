#!/usr/bin/env node
/**
 * INSTANCE-TEKST — de voorvlucht van de schermen-export, offline en zonder Figma.
 *
 * WAAROM DIT BESTAAT. De schermen in `RowTrack - Design` zijn instances uit de library, en een
 * instance draagt de tekst van de LIBRARY-variant — de story-data van het component — tenzij
 * de builder een slot zet. Een slot bestaat alleen waar `markeerSlots` (figma-build-spec.mjs)
 * een tekstnode letterlijk gelijk vond aan een string-arg van de story. Geformatteerde tekst
 * ("27:00 min", "20 AUG 2026", "Week / Maand / Jaar") is nooit gelijk aan een arg en dus nooit
 * een slot: de instance toont dan stil de data van een ander scherm. De builder meldt dat NIET
 * (`slot-niet-gezet` vuurt alleen als er een slot ís), parity is groen (de geometrie klopt) en
 * `figma:check` is groen (elke as toetst de library, niet de vulling). Gemeten 2026-09-09 op de
 * 24 schermframes: 119 tekstnodes over vier componenten, alleen door het beeld gevonden — de
 * Historiek toonde vier ritten van "20 AUG 2026" waar de story 2 tot 5 september rendert.
 *
 * WAT HET DOET. Dezelfde beslissingen als `figma/builder.js`, op de bouwspec in plaats van op
 * het document: welke variant (`kiesVariant`, op `data-variant`), valt de instance terug
 * (`toetsInstances` + `diepVerschil`: kinderen, hoogte, opacity — de wortelmaten niet, want die
 * overschrijft de builder vóór hij toetst), en voor elke instance die blijft staan: welke
 * tekstnodes verschillen van de library-variant en hebben géén slot. Dat laatste is het getal
 * dat niemand anders telt.
 *
 * TWEEZIJDIGE RATEL. `BEKEND_*` staat op de laatste meting. Hoger = een nieuw stil gat, lager =
 * winst die je vastlegt door de constante te verlagen. Beide kanten falen, zodat een verbetering
 * niet stil meereist en een verslechtering niet stil binnenkomt (HANDOFF 2026-09-09: de ratels
 * waren eenrichting en niets duwde ze omlaag).
 *
 *   node scripts/instance-tekst.mjs               # rapport + ratel
 *   node scripts/instance-tekst.mjs --lijst       # plus elke stille tekstnode met zijn pad
 *   node scripts/instance-tekst.mjs --geen-ratel  # alleen rapporteren
 *   node scripts/instance-tekst.mjs --selftest    # drie kanten: controle, slot erbij, slot eraf
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIJST = process.argv.includes('--lijst');
const GEEN_RATEL = process.argv.includes('--geen-ratel');
const SELFTEST = process.argv.includes('--selftest');

// Laatste meting: 2026-09-09, 24 frames, 135 instances. Een eerdere telling zonder de
// terugval-toets zei 119: daar zaten de 96 WheelPicker-items in, en die instance valt terug
// (scrollinhoud 2000 tegen 4400) en toont dus wél de schermdata. Vandaar de toets vóór de telling.
//
// NUL, en dat is een VLOER, geen toevallige stand. `markeerAfgeleideSlots` in de pruner leidt
// een slot af uit tekst die tussen twee SCHERMVOORKOMENS van hetzelfde component verschilt;
// dat sloot dezelfde dag 23 -> 0. Elke nieuwe stille tekst is dus een echte regressie: een
// component waarvan de data-as niet meer als slot uitgedrukt wordt. De ratel blijft tweezijdig
// zodat een verhoging even zichtbaar is als een verlaging.
const BEKEND_ZONDER_SLOT = 0;
const BEKEND_TERUGVAL = 37;
const TOL = 0.5;

const paren = (str) => new Map(String(str).split(/[;,]\s*/).filter(Boolean)
  .map(p => { const i = p.indexOf('='); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; }));

/** Zelfde opvouwregel als `maak` en `bedektIn` in figma/builder.js. */
const bedektIn = (n) => {
  const rand = n.border ?? 0;
  return (k) => k.abs && !k.k && !k.t && (k.grad || k.bg)
    && Math.abs(k.dx ?? 0) <= rand + 0.5 && Math.abs(k.dy ?? 0) <= rand + 0.5
    && k.w >= n.w - 2 * rand - 0.5 && k.h >= n.h - 2 * rand - 0.5;
};
const echteKinderen = (n) => (n.k ?? []).filter(k => !bedektIn(n)(k));

function compWortel(boom, naam) {
  let w = null;
  (function zoek(n) { if (w) return; if (n.component === naam) { w = n; return; } (n.k ?? []).forEach(zoek); })(boom);
  return w;
}

/** Dezelfde keuze als builder.kiesVariant: elk paar uit de Figma-variantnaam moet in data-variant staan. */
function kiesVariant(n, def, eigen) {
  if (!def.varianten) return { variant: eigen.varianten[0] };
  if (!n.variant) return { reden: 'geen data-variant' };
  const gemeten = paren(n.variant);
  const tr = Object.keys(def.varianten).filter(naam => [...paren(naam)].every(([as, w]) => gemeten.get(as) === w));
  if (tr.length !== 1) return { reden: `${tr.length} variant(en) passen` };
  const v = eigen.varianten.find(x => x.naam === tr[0]);
  return v ? { variant: v } : { reden: `variant ${tr[0]} niet in de spec` };
}

/** Dezelfde toets als builder.toetsInstances + diepVerschil, met de library-variant als "Figma-kant". */
function wijktAf(lib, spec, pad = '') {
  const kl = echteKinderen(lib), ks = echteKinderen(spec);
  if (kl.length !== ks.length) return `${pad || 'wortel'}: kinderen ${kl.length} tegen ${ks.length}`;
  for (let i = 0; i < ks.length; i++) {
    const l = kl[i], s = ks[i], p2 = `${pad}>${s.naam ?? i}`;
    const tekst = !!s.t && !s.k;
    const hoogteGezet = !tekst || s.h > (s.t.lh ?? s.t.px * 1.35) * 1.5;
    if (hoogteGezet && Math.abs((l.h ?? 0) - (s.h ?? 0)) > TOL) return `${p2}: hoogte ${l.h} tegen ${s.h}`;
    if (Math.abs((l.opacity ?? 1) - (s.opacity ?? 1)) > 0.01) return `${p2}: opacity ${l.opacity ?? 1} tegen ${s.opacity ?? 1}`;
    const d = wijktAf(l, s, p2);
    if (d) return d;
  }
  return null;
}

function teksten(n, pad, uit) {
  if (n.t) uit.push({ pad, s: n.t.s, slot: n.slot ?? null });
  (n.k ?? []).forEach((k, i) => teksten(k, pad === '' ? String(i) : pad + '>' + i, uit));
  return uit;
}

export function analyse(min, keys) {
  const per = {};
  const stil = [], terugval = [], overgeslagen = [], slotTreffers = [];
  let instances = 0;
  for (const [scherm, s] of Object.entries(min.schermen)) {
    for (const fr of s.frames) {
      (function loop(n) {
        const naam = n.component;
        const eigen = naam && naam !== scherm ? min.componenten[naam] : null;
        if (eigen) {
          const def = keys.componenten[naam];
          const plek = `${scherm}/${fr.naam} ${naam}`;
          if (!def || def.status === 'UNPUBLISHED') { overgeslagen.push(`${plek}: niet gepubliceerd`); return (n.k ?? []).forEach(loop); }
          if (eigen.varianten.some(v => (v.overlays ?? []).length)) { overgeslagen.push(`${plek}: portaleert`); return (n.k ?? []).forEach(loop); }
          instances++;
          const p = per[naam] ??= { instances: 0, terugval: 0, gelijk: 0, slot: 0, zonderSlot: 0 };
          p.instances++;
          const keuze = kiesVariant(n, def, eigen);
          if (!keuze.variant) { p.terugval++; terugval.push(`${plek}: ${keuze.reden}`); return; }
          const lib = compWortel(keuze.variant.boom, naam);
          if (!lib) { p.terugval++; terugval.push(`${plek}: componentwortel niet in de library-boom`); return; }
          const d = wijktAf(lib, n);
          if (d) { p.terugval++; terugval.push(`${plek}: ${d}`); return; }
          const tl = teksten(lib, '', []), ts = teksten(n, '', []);
          for (const x of ts) {
            const l = tl.find(y => y.pad === x.pad);
            if (!l) continue;
            if (l.s === x.s) p.gelijk++;
            else if (l.slot) { p.slot++; slotTreffers.push({ naam, variant: keuze.variant.naam, pad: x.pad }); }
            else { p.zonderSlot++; stil.push(`${plek} ${x.pad}: "${l.s}" (library) waar het scherm "${x.s}" toont`); }
          }
          return;
        }
        (n.k ?? []).forEach(loop);
      })(fr.boom);
    }
  }
  return { instances, per, stil, terugval, overgeslagen, slotTreffers, zonderSlot: stil.length, terugvalTotaal: terugval.length };
}

/** De library-tekstnode op een pad vanaf de componentwortel van een variant — voor de zelftest. */
function libNode(min, naam, variantNaam, pad) {
  const eigen = min.componenten[naam];
  const v = eigen.varianten.find(x => x.naam === variantNaam) ?? eigen.varianten[0];
  let n = compWortel(v.boom, naam);
  for (const i of String(pad).split('>').filter(s => s !== '')) n = n.k[Number(i)];
  return n;
}

const lees = () => ({
  min: JSON.parse(readFileSync(join(APP, 'figma/build-spec.min.json'), 'utf8')),
  keys: JSON.parse(readFileSync(join(APP, 'figma/library-component-keys.json'), 'utf8')),
});

if (SELFTEST) {
  // TEGENPROEF, drie kanten. Een controle die gelijk blijft, een mutatie die het getal omlaag
  // moet duwen (een stille tekst krijgt een slot in de library) en één die het omhoog moet
  // duwen (een bestaand slot verdwijnt). Geven de mutaties hetzelfde getal als de controle,
  // dan meet dit script niets en is dát de enige geldige conclusie.
  const { min, keys } = lees();
  const a = analyse(min, keys), b = analyse(min, keys);
  const eis = (naam, ok, detail = '') => { console.log(`  ${ok ? 'ok ' : 'XX '} ${naam}${detail ? ' — ' + detail : ''}`); if (!ok) process.exitCode = 1; };
  eis('controle: twee runs, zelfde getal', a.zonderSlot === b.zonderSlot && a.terugvalTotaal === b.terugvalTotaal, `${a.zonderSlot}/${a.terugvalTotaal}`);
  /**
   * MUTATIE 1 — een slot erbij geeft één stille tekst minder.
   *
   * Deze kant ZOCHT tot 2026-09-09 een bestaand stil geval om te repareren, en dat werkte
   * alleen zolang er stille gevallen waren. Sinds `markeerAfgeleideSlots` staat de teller op
   * nul en had de zelftest niets meer om te muteren: hij meldde `XX er is een stil geval om
   * te muteren` en de hele as was daarmee onbewijsbaar. Een tegenproef die afhangt van de
   * aanwezigheid van het defect verdwijnt precies wanneer het defect verdwijnt.
   *
   * Hij MAAKT het defect nu zelf: neem een slot weg (dat levert stille teksten op), zet er
   * daarna één terug, en eis dat het getal precies één zakt. Twee kanten uit dezelfde
   * mutatie, en allebei op een toestand die altijd op te wekken is.
   */
  const weg1 = a.slotTreffers[0];
  eis('er is een gebruikt slot om het defect mee te maken', !!weg1, weg1 ? `${weg1.naam}[${weg1.variant}] ${weg1.pad}` : '');
  if (weg1) {
    const kaal = structuredClone(min);
    delete libNode(kaal, weg1.naam, weg1.variant, weg1.pad).slot;
    const stil = analyse(kaal, keys);
    eis('het defect is opgewekt', stil.zonderSlot > a.zonderSlot, `${a.zonderSlot} → ${stil.zonderSlot}`);
    /**
     * Terug naar de basislijn, EXACT. "Eén minder" was de oude eis en die klopte alleen zolang
     * elk stil geval zijn eigen pad had; één library-node bedient 21 KpiRow-instances, dus
     * hetzelfde slot terugzetten haalt er 21 tegelijk weg. Een exacte terugkeer is bovendien
     * een scherpere claim dan "minder": hij sluit uit dat de as op iets anders reageert.
     */
    const m1 = structuredClone(kaal);
    libNode(m1, weg1.naam, weg1.variant, weg1.pad).slot = 'zelftest';
    const c = analyse(m1, keys);
    eis('hetzelfde slot terug → exact terug op de basislijn', c.zonderSlot === a.zonderSlot,
      `${stil.zonderSlot} → ${c.zonderSlot}, basislijn ${a.zonderSlot}`);
  }
  // mutatie 2: een slot dat een BLIJVENDE instance ook echt gebruikt verdwijnt → meer stille
  // teksten. Niet zomaar het eerste slot in de library: dat kan van een component zijn dat in
  // geen enkel scherm als instance staat (BleStatusBar), en dan beweegt er niets — gemeten.
  const m2 = structuredClone(min);
  // Bewust een slot van een ÁNDER component dan mutatie 1: twee keer aan dezelfde hendel
  // trekken bewijst niets over de tweede.
  const weg = a.slotTreffers.find(x => x.naam !== weg1?.naam) ?? a.slotTreffers[0];
  eis('er is een gebruikt slot van een ander component om weg te nemen', !!weg, weg ? `${weg.naam}[${weg.variant}] ${weg.pad}` : '');
  if (weg) {
    delete libNode(m2, weg.naam, weg.variant, weg.pad).slot;
    const c = analyse(m2, keys);
    eis('gebruikt slot eraf → meer stille teksten', c.zonderSlot > a.zonderSlot, `${a.zonderSlot} → ${c.zonderSlot} (${weg.naam})`);
  }
  process.exit(process.exitCode ?? 0);
}

const { min, keys } = lees();
const r = analyse(min, keys);
console.log(`\ninstance-tekst — ${Object.keys(min.schermen).length} schermen, ${Object.values(min.schermen).reduce((n, s) => n + s.frames.length, 0)} frames, ${r.instances} instances\n`);
console.log('  component               inst  terugval  gelijk  slot  ZONDER SLOT');
for (const [c, p] of Object.entries(r.per).sort((a, b) => b[1].zonderSlot - a[1].zonderSlot || b[1].terugval - a[1].terugval))
  console.log(`  ${c.padEnd(22)} ${String(p.instances).padStart(5)} ${String(p.terugval).padStart(9)} ${String(p.gelijk).padStart(7)} ${String(p.slot).padStart(5)} ${String(p.zonderSlot).padStart(12)}`);
console.log(`\n  terugval (subboom nagebouwd, toont de schermdata): ${r.terugvalTotaal}`);
console.log(`  stil (instance blijft staan, toont library-data) : ${r.zonderSlot}`);
if (r.overgeslagen.length) console.log(`  overgeslagen (niet gepubliceerd / portaleert)   : ${r.overgeslagen.length}`);
if (LIJST) {
  console.log('\n  stil:'); r.stil.forEach(x => console.log('    ' + x));
  console.log('\n  terugval:'); r.terugval.forEach(x => console.log('    ' + x));
}
if (!GEEN_RATEL) {
  const fout = [];
  if (r.zonderSlot > BEKEND_ZONDER_SLOT) fout.push(`stille teksten: ${r.zonderSlot} tegen bekend ${BEKEND_ZONDER_SLOT} — nieuw gat; zoek het met --lijst`);
  if (r.zonderSlot < BEKEND_ZONDER_SLOT) fout.push(`stille teksten: ${r.zonderSlot} tegen bekend ${BEKEND_ZONDER_SLOT} — winst; zet BEKEND_ZONDER_SLOT op ${r.zonderSlot}`);
  if (r.terugvalTotaal > BEKEND_TERUGVAL) fout.push(`terugval: ${r.terugvalTotaal} tegen bekend ${BEKEND_TERUGVAL} — meer kopieën in plaats van instances`);
  if (r.terugvalTotaal < BEKEND_TERUGVAL) fout.push(`terugval: ${r.terugvalTotaal} tegen bekend ${BEKEND_TERUGVAL} — winst; zet BEKEND_TERUGVAL op ${r.terugvalTotaal}`);
  if (fout.length) { console.log('\n  XX ' + fout.join('\n  XX ')); process.exit(1); }
  console.log(`\n  ok — ratel op ${BEKEND_ZONDER_SLOT} stil / ${BEKEND_TERUGVAL} terugval`);
}
