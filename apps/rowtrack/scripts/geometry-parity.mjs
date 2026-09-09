#!/usr/bin/env node
/**
 * De maat-as tussen Figma en de browser — recursief, op elke node van elke variant én van
 * elk schermframe.
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
 * WAAROM RECURSIEF (2026-09-08). Tot vandaag itereerde dit script alleen `spec.componenten`
 * en las het alleen de WORTELNODE per variant: ~10 velden x ~110 wortels. De schermen stonden
 * in `spec.schermen` en werden nooit gelezen. Een refactor die een binnen-gap verliest of een
 * wrapper toevoegt was per constructie onzichtbaar — precies het vangnet dat een sneden-plan
 * nodig heeft. Nu loopt de vergelijking de hele boom af, op boompad, en telt hij de schermen mee.
 *
 * DE JOIN-SLEUTEL is de variantnaam plus het boompad. Figma noemt een node `active=true`, en
 * precies die naam staat in figma/build-spec.json; daarbinnen is de index van het kind de sleutel.
 *
 * DRIE SYNTHESEREGELS staan tussen de twee bomen in, alle drie uit figma/builder.js. Ze staan
 * hier op EEN plek (`kinderparen`), niet in het Figma-leesrecept, zodat de mapping toetsbaar is:
 *
 *  1. builder.js:217-220 — een absoluut kind dat de ouder bedekt en alleen een vulling draagt,
 *     wordt de ACHTERGROND van die ouder. Het verdwijnt dus als kind: `bedekt()` filtert het
 *     aan de spec-kant weg vóór de indices gepaard worden.
 *  2. builder.js:259 — een frame met tekst EN kinderen krijgt een extra tekstkind `label`,
 *     achteraan. Figma heeft daar dus een kind meer; het laatste wordt niet bezocht.
 *  3. builder.js:107 — een Ionicons-glyph bestaat niet als Figma-font en staat er als bewuste
 *     placeholder (gestippeld kader, radius 2). Die node vult wel de kindpositie, maar
 *     vergelijken meet de placeholder in plaats van het component: overgeslagen, geteld.
 *
 * WAT ER VERGELEKEN WORDT per node: hoogte · horizontale padding · gap · radius ·
 * randbreedte · opacity · de AANWEZIGHEID van een vulling, rand en effect · het AANTAL kinderen.
 *
 * WAT ER BEWUST BUITEN BLIJFT:
 *  · BREEDTE — tekstgedreven; Figma's tekstengine en Chromium's font-metrics geven bij
 *    identieke tekst andere getallen (gemeten 2026-09-07: SectionHeader 162,78 tegen 136).
 *    Geldt op elke diepte, dus ook op binnen-tekstnodes.
 *  · KLEUR en SCHADUWVORM — daarvoor is een beeldvergelijking nodig, en die is in Chromium
 *    geen identiteitstoets (AA-ruis, umanex-os LEARNINGS 2026-08-25). De aanwezigheid wordt
 *    wel getoetst: een getal dat niets tekent is anders ook een groene meting.
 *  · VERTICALE PADDING bij een vaste hoogte — die bepaalt de doos daar niet.
 *  · Alles wat de bouwspec afkapte (voorbij diepte 4 of 8 broers) — expliciet, zie het slot.
 *
 * Vereist figma/geometry.figma.json op SCHEMA 2 — het recursieve recept staat in
 * apps/rowtrack/CLAUDE.md → Verify-pad. Schema 1 (alleen wortels) wordt geweigerd, niet
 * stil half gelezen.
 *
 * Gebruik: node scripts/geometry-parity.mjs [--verbose] [--alles] [--selftest]
 *   --alles                 elk verschil afdrukken in plaats van de eerste 40
 *   --figma=<pad>           de Figma-kant elders lezen (poort-tegenproef, CI-fixture)
 *   --schrijf-fixture=<pad> een uit de spec gesynthetiseerde Figma-kant wegschrijven
 *   --zonder-uitsluiting    figma/niet-reproduceerbaar.json negeren (tegenproef van de lijst)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bedektPredikaat, echteKinderen, heeftVulling, isIcoon, isTekstNode, kindPad } from './spec-boom.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');
const SELFTEST = process.argv.includes('--selftest');
const vlag = (naam) => process.argv.find((a) => a.startsWith(`--${naam}=`))?.slice(naam.length + 3);
// --figma=<pad> laat de Figma-kant elders staan. Nodig om de schema-poort op ZIJN GROENE kant
// te toetsen (een echt schema-2-bestand moet hij aannemen, niet alleen schema 1 weigeren)
// zonder de laatste echte Figma-lezing te overschrijven.
const FIGMA_PAD = vlag('figma');
// --schrijf-fixture=<pad> schrijft een uit de spec gesynthetiseerde Figma-kant weg.
const FIXTURE = vlag('schrijf-fixture');

const spec = JSON.parse(readFileSync(join(APP, 'figma/build-spec.min.json'), 'utf8'));

/**
 * Nodes die per meetmoment een andere maat hebben — een roterende spinner, gerandomiseerde
 * confetti. GEMETEN door scripts/instabiele-nodes.mjs (twee walker-runs, node voor node), niet
 * met de hand opgeschreven: een echte afwijking hoort zich hier niet in te kunnen verstoppen.
 * Ontbreekt het bestand, dan sluit deze as niets uit en zégt hij dat — een stille 0 zou als
 * "er valt niets uit te sluiten" lezen.
 */
const nrPad = join(APP, 'figma/niet-reproduceerbaar.json');
// --zonder-uitsluiting is de TEGENPROEF van de uitsluitingslijst zelf: een mutatie binnen een
// uitgesloten subboom hoort mét de lijst stil te blijven en zónder de lijst rood te worden.
// Blijft hij in beide gevallen stil, dan sluit de lijst niets uit maar meet de as daar niets —
// twee toestanden die er in de uitvoer identiek uitzien.
const nrData = (!process.argv.includes('--zonder-uitsluiting') && existsSync(nrPad))
  ? JSON.parse(readFileSync(nrPad, 'utf8')) : null;
const nrKlassen = new Set(nrData?.klassen ?? []);
const nrPaden = new Set(nrData?.paden ?? []);
/** Uitgesloten als het PAD gemeten is, óf als een segment tot een gemeten KLASSE hoort. */
const nietReproduceerbaar = nrData
  ? { has: (pad) => nrPaden.has(pad) || pad.split('>').some((seg) => nrKlassen.has(seg.replace(/^\d+:/, ''))) }
  : null;

// Tolerantie. Figma en Chromium ronden subpixels verschillend af; 0,5px is ruim genoeg voor
// die ruis en eng genoeg dat elke echte maatwijziging (de kleinste stap in de spacingschaal
// is 2px) er ruim doorheen komt.
const TOL = 0.5;
const dichtbij = (a, b) => a === null || b === null || Math.abs(a - b) <= TOL;

// De Figma-kant is compact gecodeerd: een node is een array. Het recept schrijft `velden`
// mee in het bestand, zodat de codering zichzelf beschrijft; deze namen zijn de lezerskant.
const F = { h: 0, paddingLeft: 1, paddingRight: 2, itemSpacing: 3, radius: 4, strokeWeight: 5, opacity: 6, vlaggen: 7, k: 8 };
const VELDNAMEN = ['h', 'paddingLeft', 'paddingRight', 'itemSpacing', 'radius', 'strokeWeight', 'opacity', 'vlaggen'];
const VULLING = 1, RAND = 2, EFFECT = 4;


/**
 * De kindparen tussen spec en Figma, met alle drie de syntheseregels erin. Geeft de gepaarde
 * kinderen plus wat er over is aan elke kant — de lengteverschillen zijn zelf een bevinding.
 */
function kinderparen(specNode, figNode) {
  const echte = echteKinderen(specNode);
  let fig = figNode[F.k] ?? [];
  // Regel 2: tekst EN kinderen -> de builder hangt er achteraan een `label`-tekstkind aan.
  const labelVerwacht = !!specNode.t && !!specNode.k;
  let labelGevonden = false;
  if (labelVerwacht && fig.length > echte.length) { fig = fig.slice(0, -1); labelGevonden = true; }
  return { echte, fig, labelVerwacht, labelGevonden };
}

/** Vergelijk één node en daal af. Vult `ctx` met bevindingen. */
function loop(specNode, figNode, pad, ctx) {
  if (isIcoon(specNode)) { ctx.overgeslagen.push(`${pad}: icoon-placeholder (regel 3)`); return; }
  if (nietReproduceerbaar?.has(pad)) { ctx.instabiel.push(pad); return; }
  ctx.nodes++;

  const tekst = isTekstNode(specNode);
  // HOOGTE OP EEN TEKSTNODE is alleen een uitspraak over de builder waar hij hem ZELF zette.
  // builder.js:148-153 zet `textAutoResize: 'HEIGHT'` plus een expliciete resize zodra de
  // browser afbrak (h > 1,5 regelhoogte), en laat Figma anders bewust zelf meten met
  // `WIDTH_AND_HEIGHT` — omdat Figma's tekstengine dezelfde tekst iets breder meet en een
  // label dat in de browser net op één regel past er anders in Figma over twee gaat.
  // Waar Figma de hoogte bepaalt, meet vergelijken de twee tekstengines en niet de bouw.
  // Gemeten 2026-09-08: 20 zulke verschillen, tot 63 tegen 48 op een emoji-glyph.
  const enkeleRegel = tekst ? (specNode.t.lh ?? specNode.t.px * 1.35) : 0;
  const hoogteGezet = !tekst || specNode.h > enkeleRegel * 1.5;
  if (tekst && !hoogteGezet) ctx.tekstHoogte++;
  const vlaggen = figNode[F.vlaggen] ?? 0;
  const paar = [
    // HOOGTE geldt ook op een tekstnode: de builder zet daar `textAutoResize` en Figma
    // herberekent hem. Dat is precies wat deze as hoort te betrappen.
    ['hoogte', specNode.h, figNode[F.h]],
    ['paddingLeft', specNode.padding?.[3] ?? 0, figNode[F.paddingLeft] ?? 0],
    ['paddingRight', specNode.padding?.[1] ?? 0, figNode[F.paddingRight] ?? 0],
    ['gap', specNode.gap ?? 0, figNode[F.itemSpacing] ?? 0],
    ['radius', specNode.radius?.[0] ?? 0, figNode[F.radius] ?? 0],
    // Figma zet strokeWeight standaard op 1, ook op een frame ZONDER strokes. Die 1 zegt
    // dus niets zolang er geen rand is; vergelijken zonder deze poort gaf 40 valse
    // verschillen (gemeten 2026-09-07, o.a. elke ghost- en destructive-knop).
    ['randbreedte', specNode.border ?? 0, (vlaggen & RAND) ? (figNode[F.strokeWeight] ?? 0) : 0],
    ['opacity', specNode.opacity ?? 1, figNode[F.opacity] ?? 1],
  ];
  const FRAME_ALLEEN = new Set(['paddingLeft', 'paddingRight', 'gap', 'radius', 'randbreedte']);
  for (const [naam, browser, figma] of paar) {
    if (tekst && FRAME_ALLEEN.has(naam)) continue;
    if (naam === 'hoogte' && !hoogteGezet) continue;
    ctx.velden++;
    if (!dichtbij(browser, figma)) ctx.verschillen.push(`${pad} ${naam}: browser ${browser} tegen Figma ${figma}`);
  }
  // Aanwezigheid, niet gelijkheid. Op een tekstnode zijn fills/strokes de glyph, geen doos.
  if (!tekst) {
    const aanwezig = [
      ['vulling', heeftVulling(specNode), !!(vlaggen & VULLING)],
      ['rand', (specNode.border ?? 0) > 0, !!(vlaggen & RAND)],
      ['effect', !!specNode.schaduwStyle, !!(vlaggen & EFFECT)],
    ];
    for (const [naam, browser, figma] of aanwezig) {
      ctx.velden++;
      if (browser !== figma) ctx.verschillen.push(`${pad} ${naam}: browser ${browser ? 'wel' : 'niet'} tegen Figma ${figma ? 'wel' : 'niet'}`);
    }
  }

  const { echte, fig, labelVerwacht, labelGevonden } = kinderparen(specNode, figNode);
  ctx.velden++;
  if (labelVerwacht && !labelGevonden) ctx.verschillen.push(`${pad} label-kind: browser wel (tekst naast kinderen) tegen Figma niet`);
  if (echte.length !== fig.length) ctx.verschillen.push(`${pad} kinderen: browser ${echte.length} tegen Figma ${fig.length}`);
  for (let i = 0; i < Math.min(echte.length, fig.length); i++)
    loop(echte[i], fig[i], kindPad(pad, i, echte[i]), ctx);
}

/** De hele meting. Geeft een verse ctx terug, zodat de zelftest hem los kan draaien. */
function meet(fig, spec) {
  const ctx = { verschillen: [], overgeslagen: [], nieuw: [], gemeten: [], instabiel: [], velden: 0, nodes: 0, tekstHoogte: 0 };
  const groepen = [
    ['componenten', spec.componenten, (d) => d.varianten],
    ['schermen', spec.schermen ?? {}, (d) => d.frames],
  ];
  for (const [soort, bron, uit] of groepen) {
    for (const [comp, d] of Object.entries(bron)) {
      const fp = fig.paginas?.[comp];
      // Een component of scherm dat nog niet in Figma staat is geen VERSCHIL maar werk dat
      // nog moet gebeuren — anders is de as tijdens elke sneden-batch onbruikbaar en leert
      // iedereen hem wegkijken. Geteld, met naam, niet rood.
      if (!fp) { ctx.nieuw.push(`${comp} (${soort}): nieuw, nog niet gebouwd`); continue; }
      for (const v of uit(d)) {
        const fv = fp.varianten?.[v.naam];
        if (!fv) { ctx.nieuw.push(`${comp}[${v.naam}]: nieuw, nog niet gebouwd`); continue; }
        // De wrapper-component draagt [boom, ...overlays] als kinderen; de wrapper zelf
        // draagt alleen de app-achtergrond en wordt niet gemeten.
        const bomen = [v.boom, ...(v.overlays ?? [])];
        if (bomen.length !== fv.length)
          ctx.verschillen.push(`${comp}[${v.naam}] wrapper-kinderen: browser ${bomen.length} tegen Figma ${fv.length}`);
        for (let i = 0; i < Math.min(bomen.length, fv.length); i++)
          loop(bomen[i], fv[i], i === 0 ? `${comp}[${v.naam}]` : `${comp}[${v.naam}]#overlay${i - 1}`, ctx);
        ctx.gemeten.push(`${comp}[${v.naam}]`);
      }
    }
  }
  return ctx;
}

/**
 * Een Figma-kant SYNTHETISEREN uit de spec, door de drie syntheseregels vooruit toe te passen.
 * Bewust GEEN vervanger voor de echte meting: dit toetst de vergelijkings-machinerie (daalt hij
 * af? klopt de indexrekening? wordt hij rood?), niet of de builder trouw schreef. Dat laatste
 * bewijst alleen `figma/geometry.figma.json` uit een echte Figma-lezing.
 */
function synthetiseer(spec) {
  const node = (n) => {
    const vlaggen = (heeftVulling(n) ? VULLING : 0) | ((n.border ?? 0) > 0 ? RAND : 0) | (n.schaduwStyle ? EFFECT : 0);
    const tekst = isTekstNode(n);
    const uit = [
      n.h,
      tekst ? 0 : (n.padding?.[3] ?? 0),
      tekst ? 0 : (n.padding?.[1] ?? 0),
      tekst ? 0 : (n.gap ?? 0),
      tekst ? 0 : (n.radius?.[0] ?? 0),
      (vlaggen & RAND) ? (n.border ?? 0) : 1,   // Figma's default-1 zonder rand
      n.opacity ?? 1,
      vlaggen,
    ];
    if (isIcoon(n)) return [n.h, 0, 0, 0, 2, 1, 1, RAND];   // placeholder-frame, regel 3
    const kinderen = (n.k ?? []).filter((k) => !bedektPredikaat(n)(k)).map(node);
    if (n.t && n.k) kinderen.push([n.h, 0, 0, 0, 0, 1, 1, 0]);   // regel 2: `label` achteraan
    if (kinderen.length) uit.push(kinderen);
    return uit;
  };
  const paginas = {};
  for (const [bron, uit] of [[spec.componenten, (d) => d.varianten], [spec.schermen ?? {}, (d) => d.frames]])
    for (const [comp, d] of Object.entries(bron)) {
      const varianten = {};
      for (const v of uit(d)) varianten[v.naam] = [v.boom, ...(v.overlays ?? [])].map(node);
      paginas[comp] = { setId: `synth:${comp}`, varianten };
    }
  return { schema: 2, gegenereerd: 'synthetisch', velden: VELDNAMEN, paginas };
}

// ── Zelftest ────────────────────────────────────────────────────────────────────────────
// Drie mutaties, elk op een ander niveau, plus een ongemuteerde controle. Zonder die vier is
// een groene parity alleen de mededeling dat er twee bestanden bestaan. De mutatie moet rood
// worden OP HET GEMUTEERDE PAD — een willekeurig verschil elders bewijst niets over de recursie.
if (SELFTEST) {
  const basis = synthetiseer(spec);
  const kopie = () => JSON.parse(JSON.stringify(basis));
  // Een pad naar een node op diepte >= 2 in het eerste component dat er een heeft.
  const diepPad = (() => {
    for (const [comp, d] of Object.entries(spec.componenten))
      for (const v of d.varianten) {
        const k0 = (v.boom.k ?? []).filter((k) => !bedektPredikaat(v.boom)(k))[0];
        if (!k0) continue;
        const k1 = (k0.k ?? []).filter((k) => !bedektPredikaat(k0)(k))[0];
        if (k1) return { comp, variant: v.naam, idx: [0, 0], naam: `${comp}[${v.naam}]>0:${k0.naam ?? '?'}>0:${k1.naam ?? '?'}` };
      }
    return null;
  })();
  const schermPad = (() => {
    const comp = Object.keys(spec.schermen ?? {})[0];
    if (!comp) return null;
    const v = spec.schermen[comp].frames[0];
    const k0 = (v.boom.k ?? []).filter((k) => !bedektPredikaat(v.boom)(k))[0];
    return k0 ? { comp, variant: v.naam, idx: [0], naam: `${comp}[${v.naam}]>0:${k0.naam ?? '?'}` } : null;
  })();
  const eersteComp = Object.keys(spec.componenten)[0];
  const eersteVar = spec.componenten[eersteComp].varianten[0].naam;

  // Een node op zijn pad opzoeken in de Figma-kant.
  const zoek = (f, doel) => { let n = f.paginas[doel.comp].varianten[doel.variant][0]; for (const i of doel.idx) n = n[F.k][i]; return n; };

  // Vijf mutaties plus een controle. De laatste twee zijn STRUCTUREEL en niet numeriek: een
  // snede die een wrapper toevoegt of een node verliest verschuift geen maat maar een BOOM,
  // en dat is precies het defect waarvoor deze as recursief werd. Een zelftest die alleen
  // getallen ophoogt bewijst daar niets over.
  const gevallen = [
    { label: 'controle (ongemuteerd)' },
    { label: 'wortel', doel: { comp: eersteComp, variant: eersteVar, idx: [], naam: `${eersteComp}[${eersteVar}]` }, veld: F.h },
    { label: 'binnennode', doel: diepPad, veld: F.h },
    { label: 'schermframe', doel: schermPad, veld: F.itemSpacing },
    { label: 'extra wrapper', doel: diepPad, structuur: 'toevoegen' },
    { label: 'node verdwenen', doel: schermPad, structuur: 'weghalen' },
  ];
  let stuk = 0;
  for (const { label, doel, veld, structuur } of gevallen) {
    if (label !== 'controle (ongemuteerd)' && !doel) { console.log(`  OVERGESLAGEN ${label} — geen geschikte node in de spec`); stuk++; continue; }
    const f = kopie();
    let verwacht = doel?.naam;
    if (doel && structuur === 'toevoegen') {
      // Een extra kind in Figma dat de spec niet heeft: de OUDER telt dan één kind te veel.
      const n = zoek(f, doel);
      (n[F.k] ??= []).push([1, 0, 0, 0, 0, 1, 1, 0]);
    } else if (doel && structuur === 'weghalen') {
      const ouder = zoek(f, { ...doel, idx: doel.idx.slice(0, -1) });
      ouder[F.k].splice(doel.idx.at(-1), 1);
      verwacht = doel.naam.slice(0, doel.naam.lastIndexOf('>'));   // de bevinding zit op de OUDER
    } else if (doel) {
      zoek(f, doel)[veld] += 5;
    }
    const r = meet(f, spec);
    const raak = doel ? r.verschillen.filter((v) => v.startsWith(verwacht + ' ')) : [];
    if (!doel) {
      if (r.verschillen.length) { console.log(`  FAAL ${label}: ${r.verschillen.length} verschil(len) zonder mutatie — ${r.verschillen[0]}`); stuk++; }
      else console.log(`  ok   ${label}: 0 verschillen over ${r.nodes} nodes, ${r.velden} velden, ${r.overgeslagen.length} overgeslagen`);
    } else if (!raak.length) {
      console.log(`  FAAL ${label}: mutatie op ${doel.naam} gaf GEEN verschil op ${verwacht} (totaal ${r.verschillen.length})`);
      stuk++;
    } else console.log(`  ok   ${label}: ${raak[0]}`);
  }
  console.log(stuk
    ? `\nzelftest: ${stuk} geval(len) stuk — de vergelijking meet niet wat hij beweert.`
    : '\nzelftest: de recursie daalt af en wordt rood op een wortel, een binnennode, een schermframe,\neen extra wrapper en een verdwenen node — en blijft groen zonder mutatie.\nDit toetst de MACHINERIE, niet de builder: de Figma-kant is hier gesynthetiseerd uit de spec.');
  process.exit(stuk ? 1 : 0);
}

if (FIXTURE) {
  writeFileSync(FIXTURE, JSON.stringify(synthetiseer(spec)));
  console.log(`fixture geschreven naar ${FIXTURE} — gesynthetiseerd uit de spec, GEEN echte Figma-lezing.`);
  process.exit(0);
}

// ── De echte meting ─────────────────────────────────────────────────────────────────────
const figmaPad = FIGMA_PAD ?? join(APP, 'figma/geometry.figma.json');
if (!existsSync(figmaPad)) {
  console.error(`geen ${figmaPad} — lees hem uit met het recept in apps/rowtrack/CLAUDE.md → Verify-pad`);
  process.exit(2);
}
const fig = JSON.parse(readFileSync(figmaPad, 'utf8'));
if (fig.schema !== 2) {
  console.error(`${figmaPad} staat op schema ${fig.schema ?? 1} (alleen wortelnodes).`);
  console.error('Deze as is sinds 2026-09-08 recursief en meet ook de schermen; een schema-1-bestand');
  console.error('zou stil 95% van de nodes overslaan. Lees hem opnieuw uit met het recursieve recept');
  console.error('in apps/rowtrack/CLAUDE.md → Verify-pad (Desktop Bridge nodig).');
  process.exit(2);
}

const r = meet(fig, spec);
console.log(`geometry-parity — ${r.gemeten.length} varianten, ${r.nodes} nodes, ${r.velden} velden vergeleken (tolerantie ${TOL}px)`);
console.log(`Figma-kant gelezen op ${fig.gegenereerd}\n`);
console.log(nietReproduceerbaar
  ? `${r.instabiel.length} node(s) niet reproduceerbaar en dus overgeslagen (gemeten door scripts/instabiele-nodes.mjs: roterende spinner, gerandomiseerde confetti)`
  : 'GEEN figma/niet-reproduceerbaar.json — er wordt niets uitgesloten; draai `npm run instabiele-nodes`');
console.log(`${r.tekstHoogte} tekstnode(s) waar Figma de hoogte bepaalt (textAutoResize WIDTH_AND_HEIGHT) — hoogte daar niet vergeleken\n`);
if (r.overgeslagen.length) { console.log(`${r.overgeslagen.length} node(s) overgeslagen:`); for (const o of r.overgeslagen.slice(0, 10)) console.log('  -- ' + o); if (r.overgeslagen.length > 10) console.log(`  -- ... en ${r.overgeslagen.length - 10} andere`); console.log(''); }
if (r.nieuw.length) { console.log(`${r.nieuw.length} nog niet in Figma (geen verschil, wel werk):`); for (const o of r.nieuw.slice(0, 15)) console.log('  ~~ ' + o); if (r.nieuw.length > 15) console.log(`  ~~ ... en ${r.nieuw.length - 15} andere`); console.log(''); }
if (r.verschillen.length) {
  // --alles drukt élk verschil af. Een afgekapte lijst is precies de vorm waarin een tweede
  // faalklasse achter de eerste verdwijnt.
  const max = process.argv.includes('--alles') ? Infinity : 40;
  for (const v of r.verschillen.slice(0, max)) console.log('  FAIL ' + v);
  if (r.verschillen.length > max) console.log(`  ... en ${r.verschillen.length - max} andere (draai met --alles)`);
  console.log(`\n${r.verschillen.length} verschil(len) tussen de Figma-node en de browser-render.`);
  process.exit(1);
}
if (VERBOSE) for (const g of r.gemeten) console.log('  ok ' + g);
console.log(`Geen verschil over ${r.nodes} nodes. Horizontale padding, gap, radius, randbreedte, opacity,`);
console.log('het aantal kinderen en de aanwezigheid van vulling/rand/effect komen overal overeen, en');
console.log(`hoogte op elke node behalve de ${r.tekstHoogte} tekstnodes waar Figma hem zelf bepaalt.`);
console.log('NIET gemeten: breedte (tekstgedreven — Figma en Chromium meten dezelfde tekst anders),');
console.log('kleurwaarde per node, schaduwvorm, icoonvorm, frame-eigenschappen op tekstnodes, de');
console.log(`${r.instabiel.length} niet-reproduceerbare nodes hierboven, en alles wat de bouwspec afkapte.`);
