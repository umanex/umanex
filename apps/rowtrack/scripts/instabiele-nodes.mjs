#!/usr/bin/env node
/**
 * Meet welke nodes NIET reproduceerbaar zijn — en levert daarmee de enige eerlijke
 * uitsluitingslijst voor `geometry-parity.mjs`.
 *
 * HET PROBLEEM. De eerste recursieve parity-run (2026-09-08) gaf 134 verschillen, waarvan 114
 * op nodes die per meetmoment een andere maat hebben. Twee bronnen:
 *
 *  · De `<ActivityIndicator>` ROTEERT (react-native-web 0.21.2, exports/ActivityIndicator:
 *    `animationKeyframes: 0% rotate(0deg) -> 100% rotate(360deg)`, 0,75 s, oneindig).
 *    `getBoundingClientRect()` geeft de AS-GELIJNDE omhullende doos, en die is voor een
 *    geroteerd vierkant `zijde * (|cos t| + |sin t|)` — tussen 20 en 28,3 px voor een zijde
 *    van 20. Welk getal je meet hangt af van het moment waarop de walker kijkt.
 *  · De confetti in MotivationalToast is GERANDOMISEERD (`size = 6 + random * 8`).
 *
 * WAAROM DIT EEN SCRIPT IS EN GEEN LIJST IN DE CODE. Een handgeschreven uitsluiting is een
 * bewering; deze is een meting die zijn eigen bewijs draagt. Draai dezelfde walker twee keer
 * en vergelijk node voor node op boompad: wat tussen twee runs van ONGEWIJZIGDE code verschilt,
 * kan per definitie door geen enkele statische vergelijking gemeten worden. Wat stabiel is,
 * blijft in de meting — dus een echte afwijking kan zich hier niet in verstoppen.
 *
 * Gemeten 2026-09-08: 140 van 2 094 nodes instabiel (68 spinnerArc, 34 spinnerBox,
 * 34 spinnerSvg, 4 confetti-item). De 20 tekst-hoogteverschillen die parity óók meldde staan
 * er NIET in — die zijn reproduceerbaar en dus een echt verschil tussen de twee tekstengines.
 *
 * Kost: twee volledige walker-runs. Draai hem opnieuw wanneer er een animatie of een
 * gerandomiseerde node bij komt of weggaat; de uitkomst is een gecommit artefact.
 *
 * Gebruik: node scripts/instabiele-nodes.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { echteKinderen, kindPad } from './spec-boom.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIN = join(APP, 'figma/build-spec.min.json');
const runs = [];

for (const n of [1, 2]) {
  process.stderr.write(`run ${n}/2 …\n`);
  execFileSync('npm', ['run', '--silent', 'figma:spec'], { cwd: APP, stdio: ['ignore', 'ignore', 'inherit'] });
  const kopie = join(tmpdir(), `rowtrack-spec-run${n}.json`);
  copyFileSync(MIN, kopie);
  runs.push(JSON.parse(readFileSync(kopie, 'utf8')));
}

const [a, b] = runs;
const paden = new Set();
let bezocht = 0;

/**
 * Alle velden die de STRENGSTE consument vergelijkt (`spec-diff.mjs`), niet alleen die van
 * `parity`. Een node die tussen twee runs van ónveranderde code op wélk veld dan ook verschilt,
 * kan door geen enkele statische vergelijking gemeten worden — dat geldt net zo goed voor
 * tekstinhoud als voor een maat.
 *
 * Gemeten 2026-09-08: met alleen de geometrie-velden bleef `ActivePhase[Samenvatting] > dateText`
 * buiten de lijst, terwijl die de KLOK toont (`new Date()` in `summaryDateLabel`). De twee runs
 * liggen minuten uit elkaar, dus de brede vergelijking vangt hem vanzelf — geen handmatige
 * uitzondering nodig. Snede 8 maakt hem overbodig: `SummaryTitle` krijgt `dateLabel` als prop,
 * en dan zet de story een vaste waarde.
 */
function loop(x, y, pad) {
  if (!x || !y) return;
  bezocht++;
  const anders = ['w', 'h', 'gap', 'opacity', 'border', 'rij', 'justify', 'align', 'positie'].some((v) => (x[v] ?? null) !== (y[v] ?? null))
    || (x.radius ?? [0])[0] !== (y.radius ?? [0])[0]
    || (x.padding ?? [0, 0, 0, 0]).join() !== (y.padding ?? [0, 0, 0, 0]).join()
    || (x.t?.s ?? null) !== (y.t?.s ?? null);
  if (anders) paden.add(pad);
  // DEZELFDE kindregel als parity: zonder de opgevouwen achtergrondkinderen. Anders lopen de
  // indices uiteen en sluit deze lijst paden uit die in de vergelijking niet bestaan
  // (gemeten 2026-09-08: 31 van 140 matchten).
  const k1 = echteKinderen(x), k2 = echteKinderen(y);
  if (k1.length !== k2.length) paden.add(pad);
  for (let i = 0; i < Math.min(k1.length, k2.length); i++)
    loop(k1[i], k2[i], kindPad(pad, i, k1[i]));
}

for (const [soort, uit] of [['componenten', (d) => d.varianten], ['schermen', (d) => d.frames]])
  for (const [comp, d] of Object.entries(a[soort] ?? {})) {
    const e = b[soort]?.[comp];
    if (!e) continue;
    uit(d).forEach((v, i) => {
      const w = uit(e)[i];
      if (!w) return;
      loop(v.boom, w.boom, `${comp}[${v.naam}]`);
      (v.overlays ?? []).forEach((o, j) => loop(o, (w.overlays ?? [])[j], `${comp}[${v.naam}]#overlay${j}`));
    });
  }

/**
 * SLUITEN PER KLASSE. De rauwe meting krimpt door meetgeluk: twee runs gaven 140 paden, de
 * derde 132 — een spinner die op twee momenten toevallig dezelfde hoek had, valt uit de lijst
 * en zou daarna als "echt verschil" terugkomen. Een uitsluitingslijst die per run wisselt is
 * geen uitsluitingslijst.
 *
 * De klasse is wél scherp, en scherper dan "de spinner": de rotatie zit in RNW op de BINNENSTE
 * View (`styles.animation` in exports/ActivityIndicator/index.js:56-62), niet op de container
 * met `role=progressbar`. De wortel `spinner` is dus wél meetbaar — en de meting bevestigt dat:
 * `spinner` stond in geen enkele run in de instabiele set, `spinnerBox` en alles eronder wel.
 * We sluiten daarom de subboom vanaf `spinnerBox`, niet vanaf `spinner`. Dat scheelt 32 nodes
 * die anders ongemeten zouden blijven.
 *
 * De sluiting wordt getoetst: ze moet een SUPERSET van de meting zijn. Is ze dat niet, dan
 * beschrijft de klasse niet wat er gemeten is en stopt het script.
 */
const gemeten = paden.size;
const gemetenPaden = new Set(paden);
function sluitAf(node, pad, binnen) {
  const in2 = binnen || node.naam === 'spinnerBox';
  if (in2) paden.add(pad);
  echteKinderen(node).forEach((k, i) => sluitAf(k, kindPad(pad, i, k), in2));
}
for (const [soort, uit] of [['componenten', (d) => d.varianten], ['schermen', (d) => d.frames]])
  for (const [comp, d] of Object.entries(a[soort] ?? {}))
    uit(d).forEach((v) => {
      sluitAf(v.boom, `${comp}[${v.naam}]`, null);
      (v.overlays ?? []).forEach((o, j) => sluitAf(o, `${comp}[${v.naam}]#overlay${j}`, null));
    });

for (const p of gemetenPaden)
  if (!paden.has(p)) {
    console.error(`de klasse-sluiting mist een GEMETEN instabiel pad: ${p}`);
    console.error('de klasse beschrijft niet wat er gemeten is — pas hem aan, sluit niets uit.');
    process.exit(2);
  }

const perNaam = {};
for (const p of paden) {
  const n = p.split('>').pop().replace(/^\d+:/, '');
  perNaam[n] = (perNaam[n] ?? 0) + 1;
}
writeFileSync(join(APP, 'figma/niet-reproduceerbaar.json'), JSON.stringify({
  $comment: 'GEGENEREERD door scripts/instabiele-nodes.mjs — twee walker-runs, node voor node op boompad. '
    + 'Deze nodes hebben per meetmoment een andere maat (roterende spinner, gerandomiseerde confetti) en '
    + 'kunnen dus door geen enkele statische vergelijking gemeten worden. NIET met de hand aanvullen: een '
    + 'echte afwijking hoort hier niet in te kunnen verdwijnen.',
  gegenereerd: new Date().toISOString().slice(0, 10),
  bezocht, gemeten, instabiel: paden.size, perNaam,
 redenen: {
  spinner: 'react-native-web ActivityIndicator roteert (animationKeyframes 0->360deg, 0,75 s, oneindig); '
    + 'getBoundingClientRect geeft de as-gelijnde doos, dus de maat hangt af van het meetmoment. '
    + 'De hele subboom is gesloten, want de rotatie geldt voor elk kind.',
  item: 'confetti in MotivationalToast — size = 6 + random * 8, dus per render een andere maat.',
 },
  paden: [...paden].sort(),
}, null, 1));
console.log(`${gemeten} van ${bezocht} nodes gemeten instabiel, gesloten tot ${paden.size} -> figma/niet-reproduceerbaar.json`);
for (const [k, v] of Object.entries(perNaam).sort((x, y) => y[1] - x[1])) console.log(`  ${String(v).padStart(4)} ${k}`);
