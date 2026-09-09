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
const MAX_DIEPTE = 8;
let afgekaptTotaal = 0;
const afkappingen = [];

const r2 = n => typeof n === 'number' ? Math.round(n * 100) / 100 : n;

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
  if (node.naamAmbigu) o.naamAmbigu = true;
  if (node.naamGestabiliseerd) o.naamGestabiliseerd = true;
  if (node.slot) o.slot = node.slot;      // deze tekstnode hangt aan een component property
  if (node.richting && node.display?.includes('flex')) o.rij = node.richting.startsWith('row');
  if (node.gap) { o.gap = r2(node.gap); if (node.gapVar) o.gapVar = node.gapVar; }
  if (node.padding.some(p => p)) {
    o.padding = node.padding.map(r2);
    if (node.paddingVar?.some(Boolean)) o.paddingVar = node.paddingVar;
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
  }
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
    o.k = houden.map((k, i) => snoei(k, volgende, `${pad}>${i}`, comp));
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
  $comment: 'GEGENEREERD door scripts/figma-build-prune.mjs. Waarden die de code gebruikt en waarvoor geen token bestaat. Elk gat heeft een item in BACKLOG.md.',
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
  const perBron = { sleutel: 0, gefold: 0, component: 0, testid: 0, laag: 0, heuristiek: 0, rnw: 0, rol: 0, terugval: 0 };
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
  const echt = perBron.sleutel + perBron.gefold + perBron.component + perBron.testid + perBron.laag + perBron.heuristiek;
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
const perComp = {};
for (const a of afkappingen) { const c = a.split('[')[0]; perComp[c] = (perComp[c] || 0) + 1; }
for (const [c, n] of Object.entries(perComp).sort((a,b)=>b[1]-a[1])) console.log(`   ${String(n).padStart(4)}x  ${c}`);
console.log('');
const rijen = [...Object.entries(uit.componenten), ...Object.entries(uit.schermen).map(([k,v])=>[k+' (scherm)',v])]
  .map(([c, d]) => [c, kb(d)]).sort((a,b)=>b[1]-a[1]);
for (const [c, k] of rijen.slice(0, 10)) console.log(`   ${String(k).padStart(4)} KB  ${c}`);
