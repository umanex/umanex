#!/usr/bin/env node
/**
 * Snoeit figma/build-spec.json tot wat er in Figma gebouwd wordt.
 *
 * WAAROM SNOEIEN. De rauwe spec is 6 MB, waarvan WheelPicker alleen al 1,8 MB: die rendert
 * zijn volledige waardelijst (tientallen items). Een Figma-component met zestig wielitems is
 * geen designartefact maar een screenshot in nodes. De snoei is dus zowel een transport-
 * als een ontwerpbeslissing.
 *
 * GEEN STILLE KAP. Elke afkapping laat een `afgekapt`-veld achter op de ouder met het
 * oorspronkelijke aantal, en het rapport telt ze. Een lijst die er half is ziet er in JSON
 * uit als een lijst die klopt — dat is precies de vorm die de packages/ui-guard ooit ving.
 *
 * Uitvoer: figma/build-spec.min.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// --root=<map>: zie figma-build-spec.mjs. De producent-tegenproef draait beide passen op een kopie.
const rootFlag = process.argv.find(a => a.startsWith('--root='));
const APP = rootFlag ? rootFlag.slice('--root='.length) : join(dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(readFileSync(join(APP, 'figma/build-spec.json'), 'utf8'));

const MAX_BROERS = 8;
// Vier ontwerplagen bleek te ondiep voor een schermcompositie: scherm -> scrollgebied ->
// inhoud -> knop -> LABEL is er al vijf. Gemeten 2026-09-08 op HealthConsentScreen, waar
// beide CTA-knoppen als lege omlijnde pillen in Figma stonden omdat hun label net buiten
// het budget viel. Doorvoer-wrappers tellen niet mee, dus zes telt écht zes ontwerplagen.
// Stond tot 2026-09-09 op 8 — dezelfde waarde als de walker, en met hetzelfde gevolg één laag
// verderop: de vier samenvattings-KPI's van HistoryScreen kwamen als een LEEG `valueRow` in de
// min-spec terwijl de browser er "2:35:00" toont. Anders dan de walker kapte deze stap niet
// stil (elke afkapping staat in `afkappingen`), maar 28 van de 39 regels gingen over diepte en
// niemand las ze. Gemeten over de verse spec: 8 -> 1 106 nodes over 39 plekken (706 KB),
// 10 -> 1 072 over 11 (715 KB), 12 en 14 -> identiek aan 10. Vanaf 10 blijven alleen de
// BEDOELDE breedte-afkappingen over (62 confetti-kinderen -> 4); 12 loopt gelijk met de kap
// van de walker en laat dezelfde marge.
const MAX_DIEPTE = 12;
let afgekaptTotaal = 0;
const afkappingen = [];

const r2 = n => typeof n === 'number' ? Math.round(n * 100) / 100 : n;

/**
 * HUGT DEZE TEKST, OF IS HIJ EEN BLOK?
 *
 * `rekt` komt uit de walker en leest `align-self: stretch` als "rekt mee met zijn ouder". Voor
 * een tekst is dat geen intentie: RNW zet `alignItems: stretch` op élke View, dus élk tekst-kind
 * van een kolom "rekt" — terwijl de run zelf zo breed is als zijn glyphs. FILL op zo'n node pint
 * de breedte in Figma, en Figma's tekstengine meet dezelfde tekst breder dan Chromium, dus de
 * tekst breekt af waar de browser hem op één regel toont. Gemeten 2026-09-09 op de 24
 * schermframes: 124 van 625 tekstnodes kregen FILL, 97 daarvan éénregelig; "1 sep 2026" (doos
 * 159,03 = run 159,03) stond in Figma in twee regels over de terug-link heen.
 *
 * Dus: H blijft alleen staan wanneer de DOOS aantoonbaar breder is dan de RUN — dan is de tekst
 * een blok dat zijn ouder vult en doet `t.al` (de uitlijning) het werk. Anders hugt hij, en dan
 * is de breedte van Figma's engine gewoon de breedte. De drempel is gemeten op de verdeling van
 * `w - inhoudBreedte` over alle tekstnodes (zie de meting bij de constante).
 */
const TEKST_BLOK_DREMPEL = 4;   // gemeten: 5 065 nodes ≤ 0,5 · 1 in 2–4 · 2 in 4–8 · 213 > 40
const isBlok = (node) => typeof node.tekst?.inhoudBreedte === 'number'
  && node.w - node.tekst.inhoudBreedte > TEKST_BLOK_DREMPEL;
function rektVoorTekst(node) {
  if (typeof node.tekst.inhoudBreedte !== 'number') return node.rekt;   // spec van vóór de meting: niets aannemen
  return node.rekt.replace('H', isBlok(node) ? 'H' : '') || null;
}

/**
 * MARGES — DRIE VERTALINGEN, EN EEN MELDING VOOR WAT ER GEEN HEEFT.
 *
 * WAAROM. Figma's auto-layout kent geen per-kind marge. Er is `itemSpacing` (één waarde voor
 * álle gaten), `padding` (op de ouder), en verder niets. De walker las `margin` tot 2026-09-09
 * niet eens, dus de ruimte verdween zonder één melding en alles eronder schoof op. Gemeten op
 * WorkoutDetailScreen/Playground: vier kinderen van 84+54+682+84 = 904 in een frame van 932,
 * met `Segmented` op y=112 terwijl zijn broer op 84 eindigt — 28 px die nergens bestond.
 * `parity` stond daarbij groen, want die vergelijkt hoogtes en geen posities van stromende
 * kinderen.
 *
 * DE DRIE, in volgorde van "kost geen node":
 *  (b) het EERSTE of LAATSTE kind → de padding van de ouder. Exact, geen nieuwe node.
 *  (a) elk gat draagt DEZELFDE extra → `itemSpacing`. Figma heeft één waarde voor alle gaten,
 *      dus alleen het MINIMUM over de gaten mag erin.
 *  (c) wat daarna overblijft hoort bij een MIDDENkind → een spacer vóór dat kind.
 *
 * DE SPACER STAAT IN DE MIN-SPEC, NIET IN DE BUILDER. Dan bouwt de builder hem als elk ander
 * kind, staan de indices aan beide kanten gelijk, en VERGELIJKT `geometry-parity` hem in plaats
 * van hem over te slaan. Een spacer die de builder zelf verzint dwingt `kinderparen()` juist
 * blind te worden voor precies de node die de fix toevoegt — een guard die minder meet.
 *
 * LET OP BIJ HET DRAAIEN: een spacer verschuift de broer-indices, en `figma/niet-reproduceerbaar.json`
 * bewaart zijn uitsluitingen als `<pad>>i:<naam>`. Draai `npm run instabiele-nodes` dus ná
 * `figma:spec` en vóór `parity`, anders vergelijkt parity de instabiele spinner-nodes alsnog.
 *
 * ZONDER EQUIVALENT: een NEGATIEVE marge (de breakout `[0,-20,0,-20]`) en een marge op de
 * KRUIS-as. Die klemmen we op 0 én melden we (`figma/builder.js`, soort
 * `marge-zonder-equivalent`) — een stille nul is precies hoe deze hele klasse tot vandaag
 * onzichtbaar bleef.
 *
 * DE GEBONDEN VARIABELE VALT WEG waar er marge bij komt: `spacing/16` + 28 is geen `spacing/*`
 * meer, en een binding zou de opgetelde waarde in Figma stil terugzetten naar de variabele.
 */
function vouwMarges(node) {
  const uit = { gap: 0, padding: [0, 0, 0, 0], voor: new Map(), rest: [] };
  const kids = (node.kinderen ?? []).filter((k) => k.positie !== 'absolute' && k.positie !== 'fixed');
  if (!kids.length || !node.display?.includes('flex')) return uit;
  const rij = (node.richting ?? '').startsWith('row');
  const [start, eind] = rij ? [3, 1] : [0, 2];        // index in [top, right, bottom, left]
  const kruis = rij ? [0, 2] : [3, 1];
  const m = (k) => k.marge ?? [0, 0, 0, 0];
  for (const k of kids) {
    const eigen = m(k);
    if (eigen.some((v) => v < 0) || kruis.some((i) => eigen[i] > 0)) uit.rest.push([k.naam ?? 'wrapper', eigen]);
  }
  uit.padding[start] = Math.max(0, m(kids[0])[start]);
  uit.padding[eind] = Math.max(0, m(kids[kids.length - 1])[eind]);
  const gaten = kids.slice(1).map((k, i) => Math.max(0, m(kids[i])[eind]) + Math.max(0, m(k)[start]));
  if (!gaten.length) return uit;
  uit.gap = Math.min(...gaten);
  gaten.forEach((g, i) => { if (g - uit.gap > 0) uit.voor.set(kids[i + 1], g - uit.gap); });
  return uit;
}

function snoei(node, diepte, pad, comp) {
  const o = { w: r2(node.w), h: r2(node.h) };
  // De laagnaam is een BESLUIT van scripts/laagnamen.mjs; het bewijs (rKlassen, kandidaten)
  // blijft in de 6 MB build-spec.json en reist niet mee. `naamBron` alleen als hij afwijkt
  // van de norm — een sleutelnaam is de norm en hoeft niet in elk knooppunt herhaald.
  o.naam = node.naam ?? 'wrapper';
  if (node.naamBron && node.naamBron !== 'sleutel') o.naamBron = node.naamBron;
  // De gedeclareerde componentgrens reist mee: de schermen-export heeft hem nodig om te
  // beslissen of een node een INSTANCE van een library-component wordt of een gewoon frame.
  if (node.component) o.component = node.component;
  if (node.variant) o.variant = node.variant;
  if (node.naamAmbigu) o.naamAmbigu = true;
  if (node.naamGestabiliseerd) o.naamGestabiliseerd = true;
  if (node.slot) o.slot = node.slot;      // deze tekstnode hangt aan een component property
  /**
   * KNIPPEN. De builder zette `clipsContent = false` op élk frame, dus wat in de browser
   * onder de rand verdween liep in Figma gewoon door. `walker-blindvlekken` telt dat als
   * `overloop`. `visible` knipt niet; `hidden`, `scroll`, `auto` en `clip` wel — en de
   * shorthand kan twee assen dragen (`hidden auto`), dus de toets staat op de héle waarde.
   */
  if (/hidden|scroll|auto|clip/.test(node.overflow ?? '')) o.knipt = true;
  /**
   * EEN GEROLDE CONTAINER WORDT ABSOLUUT. De kinderen dragen hun gemeten `dx`/`dy` al
   * mét de rolling erin verrekend (`getBoundingClientRect` is viewport-gebaseerd), dus de
   * enige reden dat Figma item 1 toont is dat auto-layout die meting weggooit en opnieuw
   * vanaf boven stapelt. Zonder auto-layout klopt de plaatsing vanzelf — en dat scheelt een
   * extra wrapper, die `kinderparen()` in de parity-as als vierde syntheseregel zou moeten
   * kennen. `gap` en `padding` vallen weg omdat er geen stroom meer is die ze kan uitdrukken.
   */
  const gerold = (node.scrollTop ?? 0) > 0.5 || (node.scrollLeft ?? 0) > 0.5;
  if (gerold) o.gerold = [r2(node.scrollTop ?? 0), r2(node.scrollLeft ?? 0)];
  if (!gerold && node.richting && node.display?.includes('flex')) o.rij = node.richting.startsWith('row');
  // De marge van de KINDEREN wordt hier bij de gap en de padding van de OUDER opgeteld; de rest
  // gaat als spacer de kinderlijst in (zie `o.k` verderop). Een opgetelde waarde is geen
  // tokenwaarde meer, dus de binding valt op die as weg — anders zet Figma hem stil terug.
  const M = gerold ? { gap: 0, padding: [0, 0, 0, 0], voor: new Map(), rest: [] } : vouwMarges(node);
  if (!gerold && (node.gap || M.gap)) { o.gap = r2(node.gap + M.gap); if (node.gapVar && !M.gap) o.gapVar = node.gapVar; }
  if (!gerold && (node.padding.some(p => p) || M.padding.some(p => p))) {
    o.padding = node.padding.map((p, i) => r2(p + M.padding[i]));
    if (node.paddingVar?.some(Boolean)) o.paddingVar = node.paddingVar.map((v, i) => (M.padding[i] ? null : v));
  }
  if (node.radius.some(x => x)) { o.radius = node.radius.map(r2); if (node.radiusVar) o.radiusVar = node.radiusVar; }
  if (node.bg && node.bg.a > 0) { o.bg = node.bg; if (node.bgVar) o.bgVar = node.bgVar; }
  if (node.gradientStops) {
    o.grad = { hoek: node.gradientHoek, stops: node.gradientStops.map(st => ({ p: st.positie, k: st.kleur, kVar: st.kleurVar })) };
  } else if (node.backgroundImage?.includes('gradient')) o.gradientRuw = node.backgroundImage.slice(0, 80);
  if (node.herstelde) o.herstelde = node.herstelde;
  if (node.geerfd) o.geerfd = node.geerfd;
  // De positie bepaalt of een node in de auto-layout-stroom hoort of eronder ligt.
  if (node.positie === 'absolute') { o.abs = true; o.dx = r2(node.dx); o.dy = r2(node.dy); }
  if (node.borderWidth > 0) {
    o.border = r2(node.borderWidth); o.borderKleur = node.borderColor;
    if (node.borderColorVar) o.borderKleurVar = node.borderColorVar;
    if (node.borderWidthVar) o.borderVar = node.borderWidthVar;
    // `borderZijden` reist alleen mee als de zijden ECHT verschillen — 138 van 333 nodes.
    // Voor de andere 195 is `border` het volledige verhaal en zou een array van vier
    // identieke getallen de spec alleen dikker maken.
    const z = node.borderWidths ?? [node.borderWidth, node.borderWidth, node.borderWidth, node.borderWidth];
    if (new Set(z).size > 1) o.borderZijden = z.map(r2);
    // Figma's `strokes` is één verfarray voor de hele node: een kleur per zijde bestaat er
    // niet. Vandaag 0 van 333 nodes, dus dit is een wachtpost, geen open wond.
    if (node.borderKleurenVerschillen) o.randKleurRest = true;
  }
  if (node.opacity < 1) o.opacity = r2(node.opacity);
  if (node.boxShadow) {
    // Koppel de gerenderde schaduw aan een effect style door zijn LAGEN te tellen en de
    // eerste kleur te lezen — niet door de CSS-string te vergelijken, want Chromium
    // herschrijft die (kleur naar voren, px-eenheden genormaliseerd).
    const lagen = (node.boxShadow.match(/rgba?\(/g) || []).length;
    o.schaduwStyle = lagen === 4 ? 'shadow/buttonPrimary'
                   : lagen === 1 && /rgba\(255,\s*255,\s*255,\s*0\.04\)/.test(node.boxShadow) ? 'shadow/buttonOutline'
                   : null;
    if (!o.schaduwStyle) { o.schaduwOnbekend = node.boxShadow.slice(0, 90); }
  }
  // De sizing-intentie moet mee: zonder haar zet de builder alles op FIXED en is geen enkele
  // instance te strekken (gemeten 2026-09-09 op LoginScreen: wrapper 390, inhoud 224).
  if (node.rekt) { const r = node.tekst ? rektVoorTekst(node) : node.rekt; if (r) o.rekt = r; }
  if (node.zelf) o.zelf = node.zelf;
  // Alleen de AFWIJKENDE waarde reist mee: nowrap en flex-start zijn de default en zouden
  // 7 259 keer niets toevoegen. Wat overblijft is precies wat de builder moet melden.
  if (node.wrap && node.wrap !== 'nowrap') o.wrap = node.wrap;
  if (node.alignContent && !['flex-start', 'normal'].includes(node.alignContent)) o.alignContent = node.alignContent;
  if (node.justify && node.justify !== 'normal' && node.justify !== 'flex-start') o.justify = node.justify;
  if (node.align && node.align !== 'normal' && node.align !== 'stretch') o.align = node.align;
  if (node.tekst) {
    o.t = {
      s: node.tekst.inhoud, f: node.tekst.family, px: r2(node.tekst.size),
      ls: r2(node.tekst.letterSpacing), lh: node.tekst.lineHeight ? r2(node.tekst.lineHeight) : null,
      k: node.tekst.kleur,
    };
    if (node.tekst.kleurVar) o.t.kVar = node.tekst.kleurVar;
    if (node.tekst.styleRef) o.t.style = node.tekst.styleRef;
    // text-transform werkt visueel maar staat NIET in de DOM-tekst. Zonder deze regel
    // toont Figma "500m" waar de browser "500M" rendert — gemeten 2026-09-07 op SplitsList,
    // en het raakt 50 tekstnodes over 12 componenten. Figma's `textCase` is het native
    // equivalent: het bewaart de brontekst en zet alleen de weergave om.
    const TC = { uppercase: 'UPPER', lowercase: 'LOWER', capitalize: 'TITLE' };
    if (TC[node.tekst.transform]) o.t.tc = TC[node.tekst.transform];
    // De uitlijning reist mee. De walker mat `textAlign` al sinds het begin, maar hij kwam
    // hier niet doorheen en de builder zette nooit `textAlignHorizontal` — dus elke
    // gecentreerde blok-tekst landde links ("RowTrack", "Account aanmaken", "RowTrack
    // v1.0.0"). Gemeten 2026-09-09: 23 tekstnodes in de 24 schermframes. Alleen wat van
    // LEFT afwijkt reist mee; de builder vult LEFT in.
    const AL = { center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' };
    if (AL[node.tekst.align]) o.t.al = AL[node.tekst.align];
    // Een BLOK-tekst (doos breder dan run) houdt zijn breedte in Figma, ook zonder FILL: de
    // labelkolom van StatsTable is 165 breed met een run van ~40, en een hug maakte daar
    // "WATT208" van — de waarde plakte tegen het label. Gemeten 2026-09-09 over 5 295
    // tekstnodes: 5 065 op doos = run (±0,5), 213 boven de 40 px, 17 ertussen; de drempel
    // van 4 ligt in dat gat. De builder zet een blok op `HEIGHT` + vaste breedte.
    if (isBlok(node)) o.t.blok = true;
    // EEN INVOERVELD. De doos is gemeten (12 px padding boven en onder één regel van 21,6 —
    // samen de 46 die de browser meet), maar een tekstnode kan in Figma geen padding dragen.
    // De builder heeft dat onderscheid nodig: zonder `veld` plakt de placeholder bovenin die
    // doos, 12 px hoger dan in de browser, en `parity` ziet daar niets van — die vergelijkt de
    // hoogte (46 = 46), niet de plaats van de glyphs erbinnen.
    if (node.tekst.veld) o.t.veld = true;
  }
  // Wat geen auto-layout-vorm heeft reist als FEIT mee, niet als correctie: de builder maakt er
  // een melding van, zodat een breakout niet stil op nul wordt gezet.
  if (M.rest.length) o.margeRest = M.rest;
  if (node.bevatSvg) o.svg = true;
  const kids = node.kinderen ?? [];
  // Zelfde regel als in de walker: een doorvoer-wrapper (één kind, geen tekst, geen eigen
  // verf) kost geen diepte. Zonder dit sneed de snoeier de inhoud van elke overlay weg,
  // want de portal-constructie stapelt er drie tot vier op elkaar.
  const volgende = node.doorvoer ? diepte : diepte + 1;
  if (kids.length && diepte < MAX_DIEPTE) {
    // Het broer-budget gaat naar ONTWERPINFORMATIE, niet naar decoratie. Gemeten 2026-09-08:
    // MotivationalToast heeft 62 kinderen — 60 gerandomiseerde confettideeltjes plus de
    // toastkaart. Een kale `slice(0, 8)` hield acht confetti en sneed de kaart weg, waardoor
    // het component in Figma leeg stond terwijl de boom er intact uitzag. Betekenisvolle
    // kinderen eerst, daarna hoogstens twee decoratieve als representant.
    const zinvol = kids.filter(k => !k.decoratief);
    const decor = kids.filter(k => k.decoratief);
    const houden = [...zinvol.slice(0, MAX_BROERS), ...decor.slice(0, Math.max(0, Math.min(2, MAX_BROERS - zinvol.length)))];
    if (kids.length > houden.length) {
      o.afgekapt = { van: kids.length, naar: houden.length, waarvanDecoratief: decor.length };
      afgekaptTotaal += kids.length - houden.length;
      afkappingen.push(`${comp}${pad}: ${kids.length} kinderen -> ${houden.length}`
        + (decor.length ? ` (${decor.length} decoratief)` : ''));
    }
    // GEVAL (c): een marge die noch bij de padding noch bij de itemSpacing past, hoort bij één
    // gat. Figma kent daar niets voor, dus komt er een lege spacer vóór dat kind. De sleutel is
    // de KINDNODE zelf en niet zijn index: `houden` heeft decoratieve broers naar achteren
    // verplaatst en broers boven MAX_BROERS weggesneden, dus een index uit de meting slaat hier
    // een ánder kind aan. Het pad volgt `o.k.length`, zodat elk pad in de min-spec blijft
    // kloppen met de uiteindelijke kinderlijst (`instance-tekst.mjs` en de
    // niet-reproduceerbaar-sleutels lopen hem af).
    const spacerRij = (node.richting ?? '').startsWith('row');
    o.k = [];
    for (const k of houden) {
      const extra = M.voor.get(k);
      if (extra) o.k.push({ w: r2(spacerRij ? extra : 1), h: r2(spacerRij ? 1 : extra), naam: 'spacer', naamBron: 'marge' });
      const kind = snoei(k, volgende, `${pad}>${o.k.length}`, comp);
      // In een gerolde container is er geen stroom: elk kind draagt zijn eigen gemeten plek,
      // rolling inbegrepen. Een weggerold kind heeft een NEGATIEVE dy, en dat is precies wat
      // het `clipsContent` van de ouder hoort weg te snijden.
      if (gerold) { kind.abs = true; kind.dx = r2(k.dx); kind.dy = r2(k.dy); }
      o.k.push(kind);
    }
  } else if (kids.length) {
    o.dieperWeggelaten = kids.length;
    afgekaptTotaal += kids.length;
    afkappingen.push(`${comp}${pad}: ${kids.length} kinderen onder diepte ${MAX_DIEPTE}`);
  }
  return o;
}

const uit = {
  // walkerVersie + gezien + grenzen zijn KLEIN en moeten mee: `figma/build-spec.json` is
  // gitignored (39 MB), dus de guard in CI ziet alleen dit bestand. Zonder deze velden kan hij
  // "de testID staat in de code" niet leggen naast "de testID bereikte de DOM" — en dat zijn
  // twee verschillende beweringen die één instrument nooit samen meet.
  walkerVersie: spec.walkerVersie,
  gezien: spec.gezien,
  grenzen: spec.grenzen,
  weggelatenComponenten: spec.weggelatenComponenten,
  componenten: {}, schermen: {}, uitgesloten: spec.uitgesloten, afkappingen,
};
for (const [comp, d] of Object.entries(spec.componenten)) {
  uit.componenten[comp] = {
    assen: d.assen,
    slots: d.slots ?? [],
    varianten: d.varianten.map(v => ({
      naam: v.naam,
      boom: snoei(v.boom, 0, '', `${comp}[${v.naam}]`),
      // Een <Modal>-portal is een APARTE boom naast de hoofdboom, geen kind ervan. De builder
      // legt hem als absoluut kind over het frame — zoals de DOM hem over het viewport legt.
      ...(v.overlays?.length ? { overlays: v.overlays.map((o, i) => snoei(o, 0, '', `${comp}[${v.naam}] overlay${i}`)) } : {}),
    })),
  };
}
for (const [comp, d] of Object.entries(spec.schermen)) {
  uit.schermen[comp] = {
    afgeschrevenAssen: d.afgeschrevenAssen,
    frames: d.frames.map(f => ({
      naam: f.naam,
      boom: snoei(f.boom, 0, '', `${comp}[${f.naam}]`),
      ...(f.overlays?.length ? { overlays: f.overlays.map((o, i) => snoei(o, 0, '', `${comp}[${f.naam}] overlay${i}`)) } : {}),
    })),
  };
}
/**
 * AFGELEIDE SLOTS — de tekst die per VOORKOMEN verschilt.
 *
 * `markeerSlots` in de walker koppelt een story-prop aan een tekstnode: onmisbaar, maar het
 * dekt alleen wat als losse string in de args staat. WorkoutCard krijgt een `workout`-object,
 * Segmented een `options`-array — nul slots, terwijl juist die componenten hun tekst per
 * scherm veranderen. `figma:instance-tekst` telde daar 23 nodes die "stil" zijn: de instance
 * blijft staan en toont de data van een ánder scherm.
 *
 * De voor de hand liggende afleiding — diff over de STORY-VARIANTEN van het component —
 * dekt daar nul van. Een variant is een stijl-as (`size=sm`, `state=loading`); de tekst is er
 * juist constant. Wat wél varieert is het VOORKOMEN: dezelfde WorkoutCard, zestien keer in de
 * schermen, met zestien keer andere data. Een pad waar twee voorkomens verschillende tekst
 * tonen, is dus data en hoort een slot te zijn.
 *
 * Twee dingen die niet vrij zijn:
 *
 * - **Stoppen op de componentgrens.** Zowel bij het verzamelen als bij het aflopen: telde de
 *   tekst van een genest component mee bij de ouder, dan kreeg de ouder een slot op een pad
 *   BÍNNEN een andere instance, en dat is niet te zetten.
 * - **Geen naam die op een cijfer eindigt.** De `[eigenschappen]`-as van `figma:check` telt
 *   properties per stam met `k.split('#')[0].replace(/\d+$/, '')`, dus `label1` en `label2`
 *   zouden als naamclash gelezen worden — een rode as op een verschil dat er niet is. Bij een
 *   botsing gaat het pad er daarom als LETTERS achter (`0>1>2` -> `_abc`).
 */
function markeerAfgeleideSlots(uit) {
  const wortel = (boom, naam) => {
    let w = null;
    (function zoek(n) { if (w) return; if (n.component === naam) { w = n; return; } (n.k ?? []).forEach(zoek); })(boom);
    return w;
  };
  /**
   * Tekst per pad, DWARS DOOR geneste componentgrenzen heen.
   *
   * Dat lijkt fout — een slot binnen een andere instance is niet te zetten — maar in de
   * LIBRARY is een genest component geen instance: `builder.js` instantieert alleen wanneer
   * `SPEC.__instanties` gevuld is, en dat vult alleen `bouw-schermen.js`. Binnen een
   * library-component staat GoalPill dus als gewone frames, en ActiveHeader kan er een
   * property op hebben. Stopte de afdaling op de grens, dan bleven precies de vier nodes
   * stil die `figma:instance-tekst` overhield: ActiveHeader `0>2>0`/`0>2>1` en HeroPanel
   * `1>1>0`/`1>1>2` — allemaal tekst in een genest component.
   *
   * Het genest component krijgt zijn eigen slots daarnaast, uit zijn eigen voorkomens; die
   * twee bijten elkaar niet, het zijn twee verschillende Figma-componenten.
   */
  const teksten = (wortelNode) => {
    const m = new Map();
    (function loop(n, pad) {
      if (n.t) m.set(pad, String(n.t.s));
      for (const [i, k] of (n.k ?? []).entries()) loop(k, pad === '' ? String(i) : pad + '>' + i);
    })(wortelNode, '');
    return m;
  };
  /** pad "0>1>2" -> "_abc"; deterministisch en cijfervrij. */
  const letters = (pad) => '_' + pad.split('>').map(i => {
    let n = Number(i), s = '';
    do { s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
  }).join('');

  /**
   * ALLEEN SCHERMVOORKOMENS TELLEN ALS VARIATIE — de varianten juist niet.
   *
   * Een variant is een STIJL-as (`size=sm`, `state=loading`); zijn tekst is er per ontwerp
   * constant. Namen ze wél mee, dan wordt elke lijst een slotfabriek: gemeten met varianten
   * erbij kreeg WheelPicker 32 slots, één per wielrij, terwijl dat component in de schermen
   * portaleert en dus nul instances heeft. Wat een slot rechtvaardigt is dat DEZELFDE plek in
   * TWEE SCHERMEN andere data toont.
   */
  const voorkomens = new Map();
  const zet = (comp, m) => { if (!voorkomens.has(comp)) voorkomens.set(comp, []); voorkomens.get(comp).push(m); };
  for (const [scherm, sc] of Object.entries(uit.schermen))
    for (const fr of sc.frames)
      (function loop(n) {
        const naam = n.component;
        if (naam && naam !== scherm && uit.componenten[naam]) zet(naam, teksten(n));
        (n.k ?? []).forEach(loop);                       // dieper: geneste voorkomens tellen ook
      })(fr.boom);

  const toegevoegd = [];
  for (const [comp, lijst] of voorkomens) {
    if (lijst.length < 2) continue;                      // één voorkomen zegt niets over variatie
    const d = uit.componenten[comp];
    if (!d) continue;
    const bestaand = new Set(d.slots ?? []);
    const dataPaden = [];
    for (const pad of new Set(lijst.flatMap(m => [...m.keys()])))
      if (new Set(lijst.map(m => m.get(pad)).filter(x => x !== undefined)).size > 1) dataPaden.push(pad);
    if (!dataPaden.length) continue;
    /**
     * Het pad komt uit ÉÉN voorkomen; een andere variant kan een andere vorm hebben (een
     * spinner waar de ander een waarde toont), dus de afdaling kan halverwege doodlopen.
     * Dat is geen fout maar een variant zonder dat veld.
     */
    const daal = (w, pad) => {
      let n = w;
      for (const i of (pad === '' ? [] : pad.split('>'))) { n = (n?.k ?? [])[Number(i)]; if (!n) break; }
      return n;
    };
    /**
     * DE NAAM HOORT BIJ HET PAD, NIET BIJ DE VARIANT. Werd hij per variant bepaald, dan kreeg
     * hetzelfde pad in variant twee een tweede naam omdat de eerste al bezet was — gemeten:
     * `BleStatusBar.label` én `BleStatusBar.label_ab` voor pad `0>1`, wat in Figma twee
     * properties op één node zou zijn.
     */
    const naamPerPad = new Map();
    for (const pad of dataPaden) {
      /**
       * Alleen een pad waar nog GEEN slot staat. `markeerSlots` in de walker heeft de
       * story-props al gekoppeld; een naam reserveren voor een node die al bezet is, levert
       * een property zonder node op — precies de "unused property" waarop Figma de component
       * bij publicatie als invalid asset weigert, en waar de `[eigenschappen]`-as voor bestaat.
       * Gemeten vóór deze poort: 68 afgeleide slots, waarvan `Chip.value_aa` en `Button.text`
       * op nodes die de walker al had.
       */
      let laagnaam = null;
      for (const v of d.varianten) {
        const n = daal(wortel(v.boom, comp), pad);
        if (n?.t && !n.slot) { laagnaam = n.naam ?? null; break; }
      }
      if (laagnaam === null) continue;
      const stam = String(laagnaam).replace(/\d+$/, '').replace(/[^A-Za-z_]/g, '') || 'veld';
      const naam = bestaand.has(stam) ? stam + letters(pad) : stam;
      if (bestaand.has(naam)) continue;              // twee paden, dezelfde laagnaam én dezelfde letters kan niet
      bestaand.add(naam);
      naamPerPad.set(pad, naam);
      toegevoegd.push(`${comp}.${naam} (pad ${pad || 'wortel'})`);
    }
    /**
     * BOVENGRENS. Twintig tekst-properties op één component betekent dat het geen component
     * met velden is maar een LIJST, en dan is een slot per rij het verkeerde model — die
     * hoort per rij een eigen instance te zijn. Liever luid niets doen dan stil een
     * onbruikbare library bouwen.
     */
    if (naamPerPad.size > 12) {
      for (const naam of naamPerPad.values()) bestaand.delete(naam);
      toegevoegd.push(`${comp}: ${naamPerPad.size} afgeleide slots — OVERGESLAGEN, dit is een lijst, geen veldencomponent`);
      naamPerPad.clear();
    }
    for (const v of d.varianten) {
      const w = wortel(v.boom, comp);
      if (!w) continue;
      for (const [pad, naam] of naamPerPad) {
        const n = daal(w, pad);
        if (n?.t && !n.slot) n.slot = naam;
      }
    }
    d.slots = [...bestaand];
  }
  return toegevoegd;
}
const afgeleideSlots = markeerAfgeleideSlots(uit);

writeFileSync(join(APP, 'figma/build-spec.min.json'), JSON.stringify(uit));

// De gaten-inventaris apart, klein en leesbaar. `build-spec.json` is 6 MB (WheelPicker
// alleen al 1,8 MB) en staat daarom in .gitignore; de guard heeft alleen dit nodig.
const uniekeGaten = [...new Set(spec.ongebonden.map(o => (o.split(': ')[1] ?? o)))].sort();
const perComponent = {};
for (const o of spec.ongebonden) {
  const c = o.split(' ')[0];
  (perComponent[c] ??= new Set()).add(o.split(': ')[1] ?? o);
}
writeFileSync(join(APP, 'figma/ongebonden.json'), JSON.stringify({
  $comment: 'GEGENEREERD door scripts/figma-build-prune.mjs. Waarden die de code gebruikt en waarvoor geen token bestaat. Hier stond tot 2026-09-09 \"Elk gat heeft een item in BACKLOG.md\" — een bewering die niets toetste en die op die dag onwaar was: nul van de 52 kwam in BACKLOG.md voor. De [binding]-as van figma:check ratelt op het AANTAL, niet op de opvolging; wat er met een gat gebeurt staat in BACKLOG.md onder [tokens].',
  aantalUniek: uniekeGaten.length,
  aantalVoorkomens: spec.ongebonden.length,
  decoratiefGenegeerd: spec.decoratief ?? 0,
  uniek: uniekeGaten,
  perComponent: Object.fromEntries(Object.entries(perComponent).map(([k, v]) => [k, [...v].sort()])),
}, null, 1));

// ---- Laagnamen: meten op wat er ECHT in Figma komt ------------------------------------
// De ongesnoeide boom telt 7 626 nodes, waarvan er duizenden worden afgekapt vóór ze Figma
// bereiken. Een dekkingspercentage op die noemer meet iets dat niemand ooit ziet. Vandaar
// dit bestand ná de snoei, met dezelfde vorm als ongebonden.json.
{
  const plat = (n, u = []) => { u.push(n); for (const k of n.kinderen ?? n.k ?? []) plat(k, u); return u; };
  const perBron = { sleutel: 0, gefold: 0, component: 0, testid: 0, bron: 0, laag: 0, heuristiek: 0, rnw: 0, rol: 0, terugval: 0 };
  const perNaam = new Map();
  let nodes = 0, ambigu = 0, gestabiliseerd = 0, indexNamen = 0, copyNamen = 0;
  const instabiel = [];
  const vorm = (n) => `${(n.k ?? []).length}(${(n.k ?? []).map(vorm).join('')})`;
  const namenVan = (n) => [n.naam, ...(n.k ?? []).flatMap(namenVan)];

  for (const [comp, d] of Object.entries({ ...uit.componenten, ...uit.schermen })) {
    const items = d.varianten ?? d.frames ?? [];
    const bomen = items.map(v => v.boom);
    // De overlays tellen mee in de DEKKING (ze staan straks in Figma), maar niet in de
    // stabiliteitsvergelijking hieronder: die groepeert varianten op boomvorm, en een
    // modalboom hoort niet tegen een schermboom gelegd te worden.
    const alleBomen = [...bomen, ...items.flatMap(v => v.overlays ?? [])];
    for (const b of alleBomen) for (const n of plat(b)) {
      // Een spacer uit `vouwMarges` is een BOUWARTEFACT, geen app-node: er staat geen element in
      // de DOM tegenover en er is geen code die hem een naam kan geven. `echteNaamPct` meet welk
      // deel van de laagnamen uit de CODE komt; een spacer meetellen verlaagt dat getal zonder
      // dat er dekking verdween.
      if (n.naamBron === 'marge') continue;
      nodes++;
      perBron[n.naamBron ?? 'sleutel'] = (perBron[n.naamBron ?? 'sleutel'] ?? 0) + 1;
      perNaam.set(n.naam, (perNaam.get(n.naam) ?? 0) + 1);
      if (n.naamAmbigu) ambigu++;
      if (n.naamGestabiliseerd) gestabiliseerd++;
      if (/^\d+$/.test(String(n.naam))) indexNamen++;
      if (n.t && n.naam === n.t.s) copyNamen++;
    }
    const groepen = new Map();
    bomen.forEach((b, i) => { const v = vorm(b); if (!groepen.has(v)) groepen.set(v, []); groepen.get(v).push({ i, n: namenVan(b).join('>') }); });
    for (const [, g] of groepen) for (const x of g.slice(1)) if (x.n !== g[0].n) instabiel.push(`${comp}: variant ${g[0].i} tegen ${x.i}`);
  }
  const echt = perBron.sleutel + perBron.gefold + perBron.component + perBron.testid + perBron.bron + perBron.laag + perBron.heuristiek;
  // DE EERLIJKE NOEMER. Een node die `rnwRol()` benoemde is DOM die react-native-web zelf
  // schrijft — de cirkels van een ActivityIndicator, de vijf hostlagen van een Modal. Die
  // kan per constructie geen code-naam krijgen, dus hij hoorde nooit in de noemer van
  // "hoeveel laagnamen komen uit de code". Tot 2026-09-08 stond hij er wél in, en het
  // percentage had daardoor een plafond dat als tekortkoming las.
  // We trekken `perBron.rnw` af en niet "elke node met een rnw-signatuur": een ScrollView-host
  // is óók RNW-DOM, maar draagt de app-`style` en wint dus terecht een sleutel. Die telt mee.
  const appNodes = nodes - perBron.rnw;
  writeFileSync(join(APP, 'figma/laagnamen.json'), JSON.stringify({
    $comment: 'GEGENEREERD door scripts/figma-build-prune.mjs. Dekking en variant-stabiliteit van de laagnamen, gemeten op de GESNOEIDE boom — dat is wat Figma krijgt.',
    nodes, appNodes, rnwNodes: perBron.rnw, perBron,
    // Het STERFCRITERIUM van de heuristische componentgrens: elke keer dat hij vuurt is een
    // node waar de code de grens niet declareert. Ratelt naar 0; op 0 mag de tak weg.
    componentZonderTestID: perBron.heuristiek,
    heuristiekPerComponent: (spec.naamStats ?? []).filter(x => x.heuristiek)
      .map(x => `${x.component}:${x.heuristiek}`),
    echteNaamPct: +(100 * echt / appNodes).toFixed(1),
    echteNaamPctRuw: +(100 * echt / nodes).toFixed(1),
    ambigu, gestabiliseerd, indexNamen, copyNamen, instabiel,
    // Het signaal dat de producent NIET normaliseert: hoeveel posities `stabiliseer()` moest
    // gladstrijken. `instabiel` is dáárna gemeten en dus per constructie leeg; dit getal is
    // de enige onafhankelijke maat voor dezelfde eigenschap.
    instabielePosities: (spec.naamStats ?? []).reduce((a, x) => a + (x.instabielePosities ?? 0), 0),
    instabielPerComponent: (spec.naamStats ?? []).filter(x => x.instabielePosities)
      .map(x => `${x.component}:${x.instabielePosities}`),
    namen: Object.fromEntries([...perNaam].sort((a, b) => b[1] - a[1])),
  }, null, 1));
  console.log(`laagnamen: ${(100 * echt / appNodes).toFixed(1)}% uit de code (${echt}/${appNodes} app-nodes, ${perBron.rnw} rnw apart), ` +
              `${indexNamen} cijfernamen, ${copyNamen} copy-namen, ${instabiel.length} instabiel -> figma/laagnamen.json`);
}

const kb = o => Math.round(JSON.stringify(o).length / 1024);
console.log(`gesnoeid: ${kb(uit)} KB (was ${Math.round(JSON.stringify(spec).length/1024)} KB)`);
console.log(`afgekapte nodes: ${afgekaptTotaal} over ${afkappingen.length} plekken`);
console.log(`ongebonden: ${uniekeGaten.length} uniek over ${spec.ongebonden.length} voorkomens -> figma/ongebonden.json`);
console.log(afgeleideSlots.length
  ? `afgeleide slots: ${afgeleideSlots.length} — ${afgeleideSlots.slice(0, 6).join(', ')}${afgeleideSlots.length > 6 ? ', …' : ''}`
  : 'afgeleide slots: 0 — geen enkel pad verschilt tussen twee voorkomens van hetzelfde component');
const perComp = {};
for (const a of afkappingen) { const c = a.split('[')[0]; perComp[c] = (perComp[c] || 0) + 1; }
for (const [c, n] of Object.entries(perComp).sort((a,b)=>b[1]-a[1])) console.log(`   ${String(n).padStart(4)}x  ${c}`);
console.log('');
const rijen = [...Object.entries(uit.componenten), ...Object.entries(uit.schermen).map(([k,v])=>[k+' (scherm)',v])]
  .map(([c, d]) => [c, kb(d)]).sort((a,b)=>b[1]-a[1]);
for (const [c, k] of rijen.slice(0, 10)) console.log(`   ${String(k).padStart(4)} KB  ${c}`);
