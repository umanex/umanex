// ---------------------------------------------------------------------------
// Figma-builder voor RowTrack — draait via figma_execute (Figma Console MCP).
//
// Zet SPEC bovenaan op het deel van figma/build-spec.min.json dat je bouwt, en plak
// daarna dit blok ONGEWIJZIGD eronder. De builder maakt per component een pagina, per
// variant een COMPONENT, en combineert die tot een COMPONENT_SET zodra er assen zijn.
//
// Elke maat, kleur, radius en spacing komt uit de gemeten browser-render en bindt aan de
// variabele die de spec noemt. Wat geen binding heeft komt in `meldingen` — nooit stil.
// ---------------------------------------------------------------------------
await figma.loadAllPagesAsync();
const V = new Map();
for (const c of await figma.variables.getLocalVariableCollectionsAsync())
  for (const id of c.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    V.set(`${c.name}:${v.name}`, v);
  }
const TS = new Map((await figma.getLocalTextStylesAsync()).map(s => [s.name, s]));
const ES = new Map((await figma.getLocalEffectStylesAsync()).map(s => [s.name, s]));
/**
 * IN EEN ANDER BESTAND ZIJN DE STIJLEN REMOTE.
 *
 * `getLocalTextStylesAsync` en de lokale variabelen-collecties leveren in `RowTrack - Design`
 * NUL — dat bestand draait volledig op de library. Zonder deze import bindt de builder daar
 * niets: gemeten 2026-09-09 verloren twee Buttons hun `shadow/buttonPrimary`, en elke
 * kleur/radius die de spec noemt zou stil ongebonden zijn geworden.
 *
 * `SPEC.__bibliotheek` is `figma/library-keys.json`; de sleutels overleven een publicatie.
 */
/**
 * EEN IMPORT DIE HANGT IS EEN MELDING, GEEN BLOKKADE. Gemeten 2026-09-09 in RowTrack - Design:
 * `importStyleByKeyAsync` voor `type/activeProgress` kwam nooit terug — geen fout, geen
 * timeout — terwijl elf andere styles in 2 tot 9 ms landden. Omdat de builder álle styles
 * vooraf importeerde, stond de eerste schermbouw daardoor vier minuten stil. De oorzaak was
 * NIET de publicatiestatus van de library (die hypothese is dezelfde dag verworpen: na een
 * volledige herstart van de plugin importeerden dezelfde sleutels in 4 tot 410 ms, óók de 22
 * componenten die nog op CHANGED stonden) maar de import-wachtrij van de plugin-runtime, die
 * na één hangende import élke volgende import vasthoudt — eerst de verse, uiteindelijk ook de
 * gecachete. Alleen het sluiten en opnieuw starten van de Desktop Bridge-plugin in dat bestand
 * maakt hem los; een UI-herlaad niet. Dus: alleen importeren wat de spec noemt, elke import
 * met een wachttijd, en een import die de wachttijd niet haalt wordt `niet te importeren` —
 * zichtbaar in de meldingen, en het signaal om de plugin te herstarten in plaats van door
 * te bouwen op losse fontwaarden.
 */
const meldingen = [];   // vóór de imports: een gefaalde import is de eerste melding die er kan zijn
const WACHT_IMPORT_MS = 4000;
const metWacht = (belofte, wat) => Promise.race([belofte,
  new Promise((_, nee) => setTimeout(() => nee(new Error(`geen antwoord binnen ${WACHT_IMPORT_MS} ms`)), WACHT_IMPORT_MS))]);
if (SPEC.__bibliotheek) {
  const B = SPEC.__bibliotheek;
  const tekstStyles = new Set(), effectStyles = new Set();
  (function zoek(x) {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(zoek);
    if (x.t?.style) tekstStyles.add(x.t.style);
    if (x.schaduwStyle) effectStyles.add(x.schaduwStyle);
    for (const v of Object.values(x)) if (v && typeof v === 'object') zoek(v);
  })(SPEC);
  for (const naam of tekstStyles) {
    const o = B.textStyles?.[naam];
    if (TS.has(naam)) continue;
    if (!o) { meldingen.push(`text style ${naam} niet te importeren — staat niet in de library-sleutels`); continue; }
    try { TS.set(naam, await metWacht(figma.importStyleByKeyAsync(o.key))); } catch (e) { meldingen.push(`text style ${naam} niet te importeren — ${e.message}`); }
  }
  for (const naam of effectStyles) {
    const o = B.effectStyles?.[naam];
    if (ES.has(naam)) continue;
    if (!o) { meldingen.push(`effect style ${naam} niet te importeren — staat niet in de library-sleutels`); continue; }
    try { ES.set(naam, await metWacht(figma.importStyleByKeyAsync(o.key))); } catch (e) { meldingen.push(`effect style ${naam} niet te importeren — ${e.message}`); }
  }
  // ALLEEN WAT DE SPEC NOEMT. Alle 250 variabelen importeren duurde langer dan de 30 s
  // wachtlimiet van `figma_execute` (gemeten); de spec noemt er een fractie van.
  const gevraagd = new Set();
  (function zoek(x) {
    if (!x || typeof x !== 'object') return;
    for (const [k, v] of Object.entries(x)) {
      if (typeof v === 'string' && /Var$/.test(k)) gevraagd.add(v);
      else if (Array.isArray(v) && /Var$/.test(k)) for (const w of v) { if (typeof w === 'string') gevraagd.add(w); }
      else if (k === 'kVar' && typeof v === 'string') gevraagd.add(v);
      else if (v && typeof v === 'object') zoek(v);
    }
  })(SPEC);
  for (const naam of gevraagd) {
    if (V.has(naam)) continue;
    const o = B.variabelen?.[naam.replace(':', '/')];
    if (!o) { meldingen.push(`variabele ${naam} staat niet in de library-sleutels`); continue; }
    try { V.set(naam, await figma.variables.importVariableByKeyAsync(o.key)); }
    catch (e) { meldingen.push(`variabele ${naam} niet te importeren — ${e.message}`); }
  }
}
const FAM = new Map();
for (const f of await figma.listAvailableFontsAsync()) {
  const s = f.fontName.family.replace(/\s+/g, '');
  if (!FAM.has(s)) FAM.set(s, f.fontName.family);
}
const fontVan = (variant) => {
  const d = String(variant).split('_');
  const family = FAM.get(d[0]);
  if (!family || !d[1]) return null;
  const gw = d[1].replace(/^\d+/, '');
  const cursief = d[2] === 'Italic';
  return { family, style: cursief ? (gw === 'Regular' ? 'Italic' : gw + ' Italic') : gw };
};
const rgb = o => ({ r: o.r / 255, g: o.g / 255, b: o.b / 255 });
const BG = V.get('Theme:bg/base');
/**
 * Soorten meldingen — de basislijn. Elke `meldingen.push` in dit bestand hoort op precies één
 * van deze regexen te matchen, en elke regex hoort minstens één push-plek te dekken. Beide
 * kanten toetst `scripts/figma-poort-selftest.mjs` statisch op deze brontekst: een nieuwe
 * sóórt melding kan dus niet stil in de staart van `meldingen.slice()` verdwijnen, en een
 * soort zonder plek veroudert niet stil. Waarom: gemeten 2026-09-08 — de return gaf
 * `aantalMeldingen` plus `slice(0, 12)`, zonder basislijn, dus een nieuwe soort was per
 * constructie onzichtbaar (de fout-vorm van "de builder meldt, en niemand telt").
 * Volgorde telt: de eerste treffer wint. Geen `[`/`]` in de regexen — de selftest knipt
 * de lijst op de sluitende `];`.
 */
const MELDING_SOORTEN = [
  ['style-niet-te-importeren',     /^(text|effect) style .* niet te importeren/],
  ['variabele-onbekend',           /^variabele .* staat niet in de library-sleutels/],
  ['variabele-niet-te-importeren', /^variabele .* niet te importeren/],
  ['gradientstop-ongebonden',      /: gradientstop ongebonden/],
  ['variant-geen-keuze',           /heeft variant-assen maar geen data-variant|variant\(en\) van .* passen op/],
  ['component-portaleert',         /portaleert zijn inhoud/],
  ['component-niet-te-importeren', /niet te importeren \(.*\) — subboom nagebouwd/],
  ['slot-niet-gezet',              /: slot ".*" (van .* niet op pad|bestaat niet op)/],
  ['slots-niet-te-zetten',         /: slots van .* niet te zetten/],
  ['layout-niet-te-zetten',        /: gemeten layout niet op .* te zetten/],
  ['layoutalign-geweigerd',        /: layoutAlign=.* geweigerd/],
  ['fill-geweigerd',               /=FILL geweigerd|wrapper-FILL geweigerd/],
  ['fill-stil-genegeerd',          /=FILL stil genegeerd|wrapper-FILL stil genegeerd/],
  ['font-teruggevallen',           /: familie ".*" niet in Figma — teruggevallen op/],
  ['icoon-placeholder',            /: icoon .*px als placeholder/],
  ['tekst-zonder-text-style',      /: tekst zonder text style/],
  ['tekstkleur-ongebonden',        /: tekstkleur ongebonden$/],
  ['flex-mapping-onbekend',        /kent deze mapping niet$/],
  ['rand-per-zijde-geweigerd',     /: rand per zijde .* geweigerd/],
  ['randbreedte-niet-te-binden',   /: randbreedte niet te binden/],
  ['randkleur-per-zijde',          /: randkleuren verschillen per zijde/],
  ['flex-niet-gemapt',             /wordt niet gemapt/],
  ['achtergrond-ongebonden',       /: achtergrond ongebonden$/],
  ['gradient-niet-ontleed',        /: gradient niet ontleed/],
  ['randkleur-ongebonden',         /: randkleur ongebonden$/],
  ['geforceerd-overschreven',      /^GEFORCEERD OVERSCHREVEN — /],
  ['instance-wijkt-af',            /: instance van .* wijkt af \(.*\) — subboom nagebouwd/],
  ['component-property-mislukt',   /: component property ".*" mislukt/],
  ['tekst-uitlijning-geweigerd',   /: tekst-uitlijning .* geweigerd/],
  ['eigenschap-zonder-node-verwijderd', /: eigenschap ".*" zonder node verwijderd/],
  ['marge-zonder-equivalent',      /: marge .* op kind ".*" heeft geen Figma-equivalent/],
];
function soortVan(m) {
  const s = String(m);
  for (const [soort, re] of MELDING_SOORTEN) if (re.test(s)) return soort;
  return 'onbekend';
}
/** Telling per soort, plus de meldingen die geen soort hebben — díe zijn de nieuwe klasse. */
function telPerSoort(lijst) {
  const perSoort = {}; const onbekend = [];
  for (const m of lijst) {
    const s = soortVan(m); perSoort[s] = (perSoort[s] ?? 0) + 1;
    if (s === 'onbekend') onbekend.push(String(m));
  }
  return { perSoort, onbekend: onbekend.slice(0, 8) };
}
/**
 * `loadFontAsync` is de duurste stap van de bouw en wordt per tekstnode aangeroepen — bij 613
 * tekstnodes over hooguit een handvol fonts is dat honderden keren hetzelfde font. Figma cachet
 * intern wel, maar de await zelf kost een tick per node, en die tikken zijn precies wat een
 * batch over de 30 s wachtlimiet duwt.
 */
const geladen = new Map();
const laadFont = (f) => {
  const sleutel = f.family + '|' + f.style;
  if (!geladen.has(sleutel)) geladen.set(sleutel, figma.loadFontAsync(f));
  return geladen.get(sleutel);
};
/**
 * Tekstnodes die aan een component property hangen. `maak()` vult hem; de bouwlus leegt hem
 * per component. Een slot is de reden dat de library BRUIKBAAR is en niet alleen juist: zonder
 * property moet wie een instance plaatst de tekstlaag selecteren en overschrijven, en dat
 * ontkoppelt de instance van zijn master.
 */
let slotVangst = [];
const STAMP = SPEC.__stamp || '';   // de aanroeper zet de datum; de plugin-sandbox heeft geen betrouwbare klok nodig

/**
 * CSS-hoek -> Figma gradientTransform.
 *
 * Figma's identiteitsmatrix loopt links->rechts; CSS 90deg doet hetzelfde, dus de rotatie is
 * (hoek - 90). Controle: hoek 180 (CSS-default, naar onder) geeft [[0,1,0],[-1,0,1]] — de
 * waarde die Figma zelf voor een verticale verloop schrijft.
 */
function gradientTransform(hoek) {
  const a = ((hoek - 90) * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const r = n => Math.round(n * 1e6) / 1e6;
  return [[r(cos), r(sin), r(0.5 - 0.5 * cos - 0.5 * sin)],
          [r(-sin), r(cos), r(0.5 + 0.5 * sin - 0.5 * cos)]];
}

/** Bouwt een GRADIENT_LINEAR-paint met, waar mogelijk, een variabele per stop. */
function gradientPaint(grad, naamPad) {
  const stops = grad.stops.map(st => {
    const stop = { position: st.p, color: { r: st.k.r / 255, g: st.k.g / 255, b: st.k.b / 255, a: st.k.a } };
    const v = st.kVar ? V.get(st.kVar) : null;
    if (!v) { meldingen.push(`${naamPad}: gradientstop ongebonden (geen token voor deze waarde)`); return stop; }
    // De alias HANDMATIG op de stop zetten. `figma.variables.setBoundVariableForPaint`
    // weigert een ColorStop — hij eist een Paint met een `type`-discriminator — maar de
    // serialisatievorm die Figma zelf gebruikt werkt wél. Getoetst 2026-09-07 op drie assen:
    // de binding staat erop, de alias-id matcht, een tweede stop zónder alias blijft
    // ongebonden (negatieve controle), en de teruggelezen kleur is die van de variabele en
    // niet de meegegeven waarde — de binding heeft dus effect, hij staat er niet alleen.
    return { ...stop, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } } };
  });
  return { type: 'GRADIENT_LINEAR', gradientTransform: gradientTransform(grad.hoek), gradientStops: stops };
}

/**
 * INSTANCES UIT DE LIBRARY.
 *
 * `SPEC.__instanties` is een tabel component -> { key, varianten, slots, vingerafdruk }, in Node
 * samengesteld uit figma/library-component-keys.json en figma/geometry.figma.json. Staat hij er,
 * dan plaatst de builder op elke node met een GEDECLAREERDE grens (`data-testid`/`data-bron`,
 * zie scripts/laagnamen.mjs) een echte instance in plaats van de subboom na te bouwen.
 *
 * Waarom dit pas nu kan: een grens was tot ingreep 1 een heuristiek over gedeelde atomaire
 * klassen — 2 van de 45 nodes in ActivePhase waren als instance herkenbaar. Nu zijn het er 20
 * van de 113, en elke daarvan heeft een library-pagina.
 *
 * Een instance vraagt een GEPUBLICEERDE component: `importComponentByKeyAsync` gaf op
 * 2026-09-09 met een ongepubliceerde key letterlijk "Could not find a published component with
 * the key". Dezelfde key wérkte direct ná de publicatie, en veranderde daar niet door.
 */
const INST = SPEC.__instanties ?? null;

/**
 * Welke variant van een set is dit? GELEZEN uit `data-variant`, niet afgeleid.
 *
 * De vorige poging matchte op een vingerafdruk van de gemeten geometrie. Twee metingen van
 * 2026-09-09 sloopten dat idee: op de buitenmaat alleen hebben 11 van de 21 componenten
 * varianten die IDENTIEK meten (`disabled` verandert alleen de aanraking), en met tekst en
 * kleur erbij matchte hij nog maar 1 van de 88 grenzen — want een component ín een scherm toont
 * andere data dan in zijn eigen story. De informatie zit niet in de spec.
 *
 * Het component kent zijn eigen props wél, en zegt ze nu (`lib/variantData.ts`). De match is
 * volgorde-onafhankelijk en tolerant naar boven: élk paar uit de Figma-variantnaam moet in
 * `data-variant` voorkomen, extra assen worden genegeerd — `DeviceSelectionModal` draagt een
 * `visible`-mount-schakelaar die Figma bewust niet als as heeft.
 */
const paren = (str) => new Map(String(str).split(/[;,]\s*/).filter(Boolean)
  .map(p => { const i = p.indexOf('='); return [p.slice(0, i).trim(), p.slice(i + 1).trim()]; }));

function kiesVariant(n, def, naamPad) {
  if (!def.varianten) return { key: def.key, naam: null, slotPaden: def.slotPaden ?? {} };
  if (!n.variant) {
    meldingen.push(`${naamPad}: ${n.component} heeft variant-assen maar geen data-variant — `
      + 'geen keuze mogelijk, subboom nagebouwd in plaats van geïnstantieerd');
    return null;
  }
  const gemeten = paren(n.variant);
  const treffers = Object.entries(def.varianten)
    .filter(([naam]) => [...paren(naam)].every(([as, w]) => gemeten.get(as) === w));
  if (treffers.length === 1) return { key: treffers[0][1].key, naam: treffers[0][0], slotPaden: treffers[0][1].slotPaden };
  meldingen.push(`${naamPad}: ${treffers.length} variant(en) van ${n.component} passen op `
    + `"${n.variant}" — geen keuze, subboom nagebouwd in plaats van geïnstantieerd`);
  return null;
}

/** Plaats een library-instance voor deze node, of geef null en laat de builder hem nabouwen. */
async function maakInstance(n, naamPad) {
  const def = INST[n.component];
  if (def.portaleert) {
    meldingen.push(`${naamPad}: ${n.component} portaleert zijn inhoud — de library-component is daar een `
      + 'lege wrapper met de inhoud ernaast, dus één instance dekt hem niet; subboom nagebouwd');
    return null;
  }
  const keuze = kiesVariant(n, def, naamPad);
  if (!keuze) return null;
  let main;
  try { main = await figma.importComponentByKeyAsync(keuze.key); }
  catch (e) {
    meldingen.push(`${naamPad}: ${n.component} niet te importeren (${e.message}) — subboom nagebouwd`);
    return null;
  }
  const inst = main.createInstance();
  inst.name = n.component;

  // Slots vullen uit wat de spec OP DEZE PLEK meet. Niet via de `slot`-markering: die komt uit
  // de story-args van het component zelf en staat dus niet op een schermnode. Wel via het PAD
  // waar die markering in de eigen variant zat — dezelfde code rendert dezelfde boomvorm met
  // andere data (zie `slotPaden` in bouw-schermen.js).
  const waarden = {};
  for (const [slot, pad] of Object.entries(keuze.slotPaden ?? {})) {
    let x = n;
    for (const i of String(pad).split('>').filter(s2 => s2 !== '')) x = (x?.k ?? [])[Number(i)];
    if (x?.t) waarden[slot] = String(x.t.s);
    else meldingen.push(`${naamPad}: slot "${slot}" van ${n.component} niet op pad ${pad} — waarde niet gezet`);
  }
  const props = inst.componentProperties ?? {};
  const zetten = {};
  for (const [slot, waarde] of Object.entries(waarden)) {
    const volledig = Object.keys(props).find(p => p === slot || p.startsWith(slot + '#'));
    if (volledig) zetten[volledig] = waarde;
    else meldingen.push(`${naamPad}: slot "${slot}" bestaat niet op ${n.component} — waarde niet gezet`);
  }
  if (Object.keys(zetten).length) {
    try { inst.setProperties(zetten); }
    catch (e) { meldingen.push(`${naamPad}: slots van ${n.component} niet te zetten — ${e.message}`); }
  }

  /**
   * DE GEMETEN LAYOUT OVERSCHRIJVEN.
   *
   * Een instance draagt de waarden van de library-variant, en die komen uit de story van dat
   * component. Het scherm geeft andere props mee: `ActiveHeader` krijgt paddings 20 van het
   * scherm en 24 uit zijn story, een `KpiRow` in landscape is 55,7 hoog in plaats van 56.
   * Zulke props zijn geen variant-as en geen tekst-slot, dus ze reizen niet mee — en dat is
   * precies wat een ontwerper met de hand zou overschrijven.
   *
   * De override landt op de node die de layout DRAAGT, niet op de instance-wortel: die wortel
   * is de wrapper van de library, en bij een component met een story-decorator zit er nog een
   * niveau tussen. Vandaar `diepte`.
   */
  let doel = inst;
  for (let i = 0; i < 1 + (def.diepte ?? 0) && 'children' in doel && doel.children.length; i++) doel = doel.children[0];
  try {
    if (Math.abs(inst.width - n.w) > 0.5 || Math.abs(inst.height - n.h) > 0.5)
      inst.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));
    if (doel !== inst && (Math.abs(doel.width - n.w) > 0.5 || Math.abs(doel.height - n.h) > 0.5))
      doel.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));
    if (doel.layoutMode && doel.layoutMode !== 'NONE') {
      const P = n.padding ?? [0, 0, 0, 0];
      doel.paddingTop = P[0]; doel.paddingRight = P[1]; doel.paddingBottom = P[2]; doel.paddingLeft = P[3];
      doel.itemSpacing = n.gap ?? 0;
    }
    if (n.opacity !== undefined && Math.abs((doel.opacity ?? 1) - n.opacity) > 0.001) doel.opacity = n.opacity;
  } catch (e) {
    meldingen.push(`${naamPad}: gemeten layout niet op ${n.component} te zetten — ${e.message}`);
  }
  return inst;
}

/**
 * DE SIZING-INTENTIE OP DE NODE ZETTEN — pas NA het aanhangen, want `layoutSizing*` bestaat
 * alleen voor een kind van een auto-layout frame.
 *
 * Waarom dit bestaat. De builder zette elke auto-layout op `FIXED`/`FIXED`, dus elke node
 * stond star op zijn gemeten maat. Dat is als transcriptie correct en als DESIGN fout: een
 * instance kan zijn inhoud dan niet strekken, en dat is geen randgeval maar de regel —
 * gemeten 2026-09-09 op LoginScreen: een `FormField`-instance 390 breed met inhoud van 224,
 * en hetzelfde voor Button (390 tegen 151). Geen enkele guard-as zag het: parity sluit
 * breedte uit, de vlaggen matchten, en `resize()` op een instance-kind doet niets — geen
 * fout, geen effect (nagemeten, twee keer, net als `layoutMode` op een instance-wortel).
 *
 * De browser-layout ÍS flexbox en Figma's auto-layout is hetzelfde model, dus dit is een
 * mapping en geen nabouw. `rekt` komt uit de DOM (`flex-grow` op de hoofdas, `stretch` op de
 * kruis-as) en zegt per as of de node meerekt. Alles zonder intentie blijft FIXED: dat is de
 * gemeten maat, en die is per definitie getrouw.
 *
 * FILL kan mislukken — een ouder zonder auto-layout weigert hem. Dat wordt geteld en gemeld
 * in plaats van stil geslikt; een sizing die niet plakt is precies het soort stille no-op
 * waar deze hele ronde over gaat.
 */
let rekGezet = 0, rekTeruggedraaid = 0, rekGeweigerd = 0;

/**
 * DE SIZING-INTENTIE OP DE KINDEREN ZETTEN — en meteen nakijken of ze klopt.
 *
 * Waarom dit bestaat. De builder zette elke auto-layout op `FIXED`/`FIXED`, dus elke node
 * stond star op zijn gemeten maat. Correct als transcriptie, fout als DESIGN: een instance
 * kan zijn inhoud dan niet strekken. Gemeten 2026-09-09 op LoginScreen: een `FormField`-
 * instance 390 breed met inhoud van 224, en Button 390 tegen 151. Geen enkele as zag het —
 * parity sluit breedte uit, de vlaggen matchten, en `resize()` op een instance-kind doet
 * niets (geen fout, geen effect; `layoutMode` op een instance-wortel evenmin).
 *
 * WAAROM DE TERUGLEESCONTROLE. FILL is een BELOFTE over de layout, geen maat. Figma rekent
 * de restruimte anders uit dan de browser zijn flex oplost — marges bestaan in Figma niet, en
 * een scroll-container meet in de browser zijn venster en niet zijn inhoud. Gemeten: de
 * `scrollView` in DeviceSelectionModal werd 192 waar de browser 168 zegt; dat waren de enige
 * twee parity-fouten van de hele ronde. Een eerdere poging leidde dat af uit "knipt de node
 * af?" — dat was de verkeerde diagnose (er werd niets afgeknipt) en bovendien een gok.
 *
 * Dus: zet FILL, LEES TERUG, en draai terug zodra de maat afwijkt. Een mutatie die niet kan
 * klagen is een aanname; deze klaagt, en telt zichzelf.
 *
 * Pas ná álle kinderen, want een latere broer verandert de restruimte van een eerdere.
 */
function zetRek(f, kinderen, naamPad) {
  if (f.layoutMode === 'NONE') return;
  // UNIFORME EIGEN UITLIJNING GAAT OP DE OUDER. Delen alle stromende kinderen dezelfde
  // `align-self`, dan is dat gewoon `counterAxisAlignItems` van de ouder — de enige plek waar
  // Figma een kruis-as-uitlijning nog kent (12 van zulke ouders in de 24 schermframes).
  const stromend = kinderen.filter(x => !x.k.abs);
  const uniform = stromend.length && stromend.every(x => x.k.zelf && x.k.zelf === stromend[0].k.zelf) ? stromend[0].k.zelf : null;
  if (uniform && uniform !== 'STRETCH') { try { f.counterAxisAlignItems = uniform; } catch (e) { meldingen.push(`${naamPad}: layoutAlign=${uniform} geweigerd — ${e.message}`); } }
  for (const { kind, k: k0, pad } of kinderen) {
    if (k0.abs) continue;
    const k = uniform && uniform !== 'STRETCH' ? { ...k0, zelf: null } : k0;   // de ouder draagt hem al
    // De eigen kruis-as-uitlijning eerst. `layoutAlign` accepteert MIN/CENTER/MAX zonder fout
    // en NEGEERT ze — gemeten 2026-09-09 op LoginScreen: `forgot` kreeg MAX en las INHERIT
    // terug, dus "Wachtwoord vergeten?" stond links. Alleen STRETCH en INHERIT doen nog iets
    // (de rest is in de Plugin API afgeschreven). Lees dus terug, en vervang een genegeerde
    // uitlijning door wat Figma wél kent: het kind vult de kruis-as van zijn ouder en lijnt
    // zijn inhoud zelf uit — per as, want een kolom in een kolom heeft de kruis-as als
    // eigen kruis-as, een rij in een kolom als eigen hoofdas.
    if (k.zelf) {
      let ok = false;
      try { kind.layoutAlign = k.zelf; ok = kind.layoutAlign === k.zelf; } catch (e) { /* valt hieronder door */ }
      if (!ok) {
        // Alleen een kind dat zijn INHOUD kan uitlijnen mag de kruis-as vullen: een tekst, of
        // een auto-layout-frame met kinderen. Een blad (de knop van een toggle: 20×20, geen
        // kinderen) kreeg hier tot 2026-09-09 óók FILL en werd zo 40 breed — de hele pil wit,
        // gemeten op ProfileScreen. Een blad kan zijn eigen uitlijning niet dragen; die hoort
        // op de ouder (uniform, hierboven) of is niet uit te drukken — en dan is dat een melding.
        const ouderRij = f.layoutMode === 'HORIZONTAL';
        const kanZelfUitlijnen = kind.type === 'TEXT' || (kind.layoutMode && kind.layoutMode !== 'NONE' && 'children' in kind && kind.children.length);
        if (!kanZelfUitlijnen) {
          if (k.zelf !== 'MIN') meldingen.push(`${pad}: layoutAlign=${k.zelf} geweigerd — Figma negeert hem stil en een blad kan zich niet zelf uitlijnen`);
        } else try {
          kind[ouderRij ? 'layoutSizingVertical' : 'layoutSizingHorizontal'] = 'FILL';
          if (kind.type === 'TEXT') {
            if (!ouderRij) kind.textAlignHorizontal = { MIN: 'LEFT', CENTER: 'CENTER', MAX: 'RIGHT' }[k.zelf] ?? 'LEFT';
            else kind.textAlignVertical = { MIN: 'TOP', CENTER: 'CENTER', MAX: 'BOTTOM' }[k.zelf] ?? 'TOP';
          } else {
            // De kruis-as van de ouder (H onder een kolom, V onder een rij) is de hoofdas van
            // het kind als het kind de ándere richting heeft; anders zijn kruis-as. Gemeten:
            // een kolom in een kolom kreeg eerst `primaryAxisAlignItems` en zakte naar beneden.
            const kruisAsIsEigenHoofdas = (kind.layoutMode === 'HORIZONTAL') !== ouderRij;
            if (kruisAsIsEigenHoofdas) kind.primaryAxisAlignItems = k.zelf; else kind.counterAxisAlignItems = k.zelf;
          }
        } catch (e) { meldingen.push(`${pad}: layoutAlign=${k.zelf} geweigerd — ${e.message}`); }
      }
    }
    if (!k.rekt) continue;
    for (const [as, veld, maat, doel] of [
      ['H', 'layoutSizingHorizontal', 'width', k.w],
      ['V', 'layoutSizingVertical', 'height', k.h],
    ]) {
      if (!k.rekt.includes(as)) continue;
      let voor;
      try { voor = kind[veld]; kind[veld] = 'FILL'; } catch (e) {
        rekGeweigerd++; meldingen.push(`${pad}: ${veld}=FILL geweigerd — ${e.message}`); continue;
      }
      if (kind[veld] !== 'FILL') { rekGeweigerd++; meldingen.push(`${pad}: ${veld}=FILL stil genegeerd`); continue; }
      if (Math.abs(kind[maat] - doel) > 0.5) {
        // FILL geeft hier een andere maat dan gemeten: intentie klopt niet met deze layout.
        try { kind[veld] = voor === 'FILL' ? 'FIXED' : voor; kind.resize(as === 'H' ? doel : kind.width, as === 'H' ? kind.height : doel); } catch { /* laat staan */ }
        rekTeruggedraaid++;
      } else rekGezet++;
    }
  }
}

async function maak(n, naamPad, wortelComp) {
  // MARGES ZONDER FIGMA-EQUIVALENT. `vouwMarges()` in scripts/figma-build-prune.mjs vertaalt een
  // hoofdas-marge naar padding (eerste of laatste kind), itemSpacing (alle gaten gelijk) of een
  // spacer-node (middenkind). Wat overblijft heeft in auto-layout geen vorm: een NEGATIEVE marge
  // — de breakout van de Home-lijst — en een marge op de KRUIS-as. De pruner klemt die op 0, dus
  // zonder deze regel verdwijnt de uitbraak precies zoals de hele klasse tot vandaag verdween:
  // zonder één melding. Dit staat vóór de instance-tak, zodat ook een ouder die zelf een
  // instance wordt zijn gat meldt.
  for (const [kind, m] of n.margeRest ?? [])
    meldingen.push(`${naamPad}: marge ${JSON.stringify(m)} op kind "${kind}" heeft geen Figma-equivalent (negatief of kruis-as)`);
  // Een gedeclareerde grens die de library kent wordt een INSTANCE, en dan stopt de afdaling:
  // wat eronder zit hoort bij dat component en komt met de instance mee.
  if (INST && n.component && n.component !== wortelComp && INST[n.component]) {
    const inst = await maakInstance(n, naamPad);
    if (inst) return inst;
  }
  if (n.t && !n.k) {
    const stijl = n.t.style ? TS.get(n.t.style) : null;
    let font = stijl ? null : fontVan(n.t.f);
    // Een ICOON-font (Ionicons) heeft privégebruik-glyphs: zonder dat font is er niets te
    // tonen, dus daar hoort een zichtbaar slot. Een gewone niet-gevonden familie is iets
    // ANDERS — `-apple-system` bij een emoji bijvoorbeeld. Die tekst is wél te tonen; het
    // OS vult de emoji zelf in, ongeacht welk font eromheen staat. Gemeten 2026-09-08:
    // zonder dit onderscheid werden de 🏅 van PrBadge en de 🏆 van MotivationalToast
    // gestippelde kaders in plaats van emoji.
    const isIcoonFont = /^ionicons$/i.test(n.t.f ?? '');
    if (!stijl && !font && !isIcoonFont) {
      font = FAM.get('AlbertSans') ? { family: FAM.get('AlbertSans'), style: 'Regular' } : null;
      if (font) meldingen.push(`${naamPad}: familie "${n.t.f}" niet in Figma — teruggevallen op ${font.family}`);
    }
    if (!stijl && !font) {
      // Ionicons: privégebruik-glyphs zonder font. Zichtbaar icoonslot i.p.v. stilte.
      const ph = figma.createFrame();
      ph.name = n.naam || 'icon';        // nooit de maat in de naam: die verandert mee met de variant
      ph.resize(Math.max(1, n.w), Math.max(1, n.h));
      ph.fills = [];
      ph.strokes = [{ type: 'SOLID', color: { r: 0.94, g: 0.33, b: 0.33 }, opacity: 0.4 }];
      ph.strokeWeight = 1; ph.dashPattern = [2, 2]; ph.cornerRadius = 2;
      meldingen.push(`${naamPad}: icoon ${n.t.px}px als placeholder (geen Figma-font)`);
      return ph;
    }
    const t = figma.createText();
    if (stijl) {
      await laadFont(stijl.fontName);
      t.fontName = stijl.fontName;
      t.characters = String(n.t.s);
      await t.setTextStyleIdAsync(stijl.id);
      if (n.t.tc) t.textCase = n.t.tc;
    } else {
      await laadFont(font);
      t.fontName = font;
      t.characters = String(n.t.s);
      t.fontSize = n.t.px;
      t.letterSpacing = { unit: 'PIXELS', value: n.t.ls };
      if (n.t.lh) t.lineHeight = { unit: 'PIXELS', value: n.t.lh };
      if (n.t.tc) t.textCase = n.t.tc;
      meldingen.push(`${naamPad}: tekst zonder text style (${n.t.f} ${n.t.px}px)`);
    }
    const p = { type: 'SOLID', color: rgb(n.t.k), opacity: n.t.k.a };
    t.fills = n.t.kVar && V.get(n.t.kVar)
      ? [figma.variables.setBoundVariableForPaint(p, 'color', V.get(n.t.kVar))] : [p];
    if (!n.t.kVar) meldingen.push(`${naamPad}: tekstkleur ongebonden`);
    // DE UITLIJNING REIST MEE. Tot 2026-09-09 werd `textAlignHorizontal` nooit gezet: de
    // walker mat `textAlign` wel, maar hij kwam de pruner niet door. Een blok-tekst die in
    // de browser gecentreerd staat ("RowTrack", "Account aanmaken") landde daardoor links —
    // 23 tekstnodes in de 24 schermframes, alleen door het beeld gevonden. `t.al` draagt nu
    // alleen wat van LEFT afwijkt; LEFT is de default van beide engines.
    try { t.textAlignHorizontal = n.t.al ?? 'LEFT'; }
    catch (e) { meldingen.push(`${naamPad}: tekst-uitlijning ${n.t.al ?? 'LEFT'} geweigerd — ${e.message}`); }
    // De browser BREEKT tekst af op de beschikbare breedte; Figma rekt met
    // WIDTH_AND_HEIGHT tot één lange regel. Gemeten 2026-09-08 op HealthConsentScreen:
    // een alinea van 390px liep in Figma door tot ~1340px, ver buiten het frame.
    //
    // Maar de breedte vastzetten mag NIET overal. Figma's tekstengine meet dezelfde tekst
    // iets breder dan Chromium, dus een label dat in de browser NET op één regel past,
    // breekt in Figma alsnog af — gemeten op dezelfde pagina: "Ja, ik geef toestemming"
    // (193x22 in de browser) stond in Figma over twee regels.
    //
    // Dus: alleen vastzetten waar de browser ZELF afbrak. Dat is af te lezen aan de
    // gemeten hoogte tegen één regelhoogte (de tokenwaarde als die er is, anders 1,35x de
    // fontgrootte — de natuurlijke regelhoogte van deze families).
    //
    // En één regel is NIET genoeg: `zetRek()` zette daarna alsnog FILL op elke tekst met
    // `rekt: H`, en dat pint de breedte net zo goed — "1 sep 2026" hugde in de browser
    // (doos = run = 159,03) en brak in Figma toch af, over de terug-link heen. Sinds
    // 2026-09-09 beslist de pruner (`rektVoorTekst`) of een tekst een blok is (doos breder
    // dan run) of hugt; alleen een blok houdt `H`, en een blok draagt `t.blok`.
    //
    // Een blok zónder FILL houdt óók zijn breedte: de labelkolom van StatsTable is 165
    // breed met een run van ~40, en als hug werd dat "WATT208" — de waarde plakte tegen
    // het label. Vaste breedte is daar de transcriptie; de uitlijning erin doet het werk.
    const enkeleRegel = n.t.lh ?? n.t.px * 1.35;
    if (n.t.veld) {
      // EEN INVOERVELD IS EEN DOOS MET EEN REGEL ERIN. De browser meet 46 hoog (12 + 21,6 + 12);
      // een tekstnode draagt die padding niet. Dus vaste maat plus verticale uitlijning, en in
      // die volgorde — `NONE` en niet `HEIGHT`, want alleen bij een vaste maat is
      // `textAlignVertical` gedefinieerd. Dit gaat niet over de 46 maar over de 12 px die de
      // regel anders te hoog staat, en dat is iets wat `parity` per constructie niet ziet.
      t.textAutoResize = 'NONE';
      t.resize(Math.max(1, n.w), Math.max(1, n.h));
      t.textAlignVertical = 'CENTER';
    } else if (n.h > enkeleRegel * 1.5 || n.t.blok) {
      t.textAutoResize = 'HEIGHT';
      t.resize(Math.max(1, n.w), Math.max(1, n.h));
    } else {
      t.textAutoResize = 'WIDTH_AND_HEIGHT';
    }
    // NA `characters`, en altijd. Figma zet `autoRename` aan zolang de naam niet expliciet
    // gezet is, en hernoemt de laag dan bij elke toewijzing aan `characters` naar de tekst
    // zelf — precies wat regel 1 van het leesbaarheidscontract verbiedt. In de vorige ronde
    // heetten alle 613 tekstnodes daardoor naar hun eigen copy ("Doel bereikt!").
    t.name = n.naam || 'label';
    if (n.slot) slotVangst.push({ slot: n.slot, node: t, standaard: String(n.t.s) });
    return t;
  }

  const f = figma.createFrame();
  f.name = n.naam || 'wrapper';        // het besluit komt uit scripts/laagnamen.mjs
  // KNIPPEN volgt de browser. Tot 2026-09-09 stond dit hard op `false`, dus wat in de browser
  // onder de rand verdween liep in Figma door — de `overloop`-teller van
  // `walker-blindvlekken` stond daarom op 15 zonder dat één as er rood van werd. Een gerolde
  // container knipt altijd: hij toont per definitie minder dan hij bevat.
  f.clipsContent = !!n.knipt || !!n.gerold;
  if (n.k && n.rij !== undefined) {
    f.layoutMode = n.rij ? 'HORIZONTAL' : 'VERTICAL';
    f.primaryAxisSizingMode = 'FIXED';
    f.counterAxisSizingMode = 'FIXED';
    /**
     * DE UITLIJN-FAMILIE. Gemeten over 7 259 flex-containers (2026-09-09):
     * `align-items` center 5 112 · stretch 2 095 · baseline 29 · flex-start 13 · flex-end 10;
     * `justify-content` normal 4 573 · center 2 462 · space-between 213 · flex-end 11;
     * `align-content` 7 259x flex-start en `flex-wrap` 7 259x nowrap — de app wrapt nergens.
     *
     * Daarom worden die laatste twee NIET gemapt: dat zou dode code zijn. Ze worden wél
     * gemeten, en een waarde die deze mapping niet kent komt in `meldingen` terecht. Dat is
     * het verschil tussen een gat dat je kent en een gat dat stil is — voegt iemand ooit
     * `flex-wrap: wrap` toe, dan zegt de bouw het in plaats van het beeld pas veel later.
     *
     * `stretch` staat er niet bij en dat is juist: dat is geen uitlijning van de ouder maar
     * FILL op het kind, en dat regelt `zetRek()` uit de gemeten intentie.
     */
    const J = { center: 'CENTER', 'space-between': 'SPACE_BETWEEN', 'flex-end': 'MAX', 'flex-start': 'MIN', normal: 'MIN' };
    const A = { center: 'CENTER', 'flex-end': 'MAX', 'flex-start': 'MIN', baseline: 'BASELINE', normal: 'MIN', stretch: null };
    if (n.justify) {
      if (J[n.justify]) f.primaryAxisAlignItems = J[n.justify];
      else if (!(n.justify in J)) meldingen.push(`${naamPad}: justify-content '${n.justify}' kent deze mapping niet`);
    }
    if (n.align) {
      if (A[n.align]) f.counterAxisAlignItems = A[n.align];
      else if (!(n.align in A)) meldingen.push(`${naamPad}: align-items '${n.align}' kent deze mapping niet`);
    }
    if (n.wrap && n.wrap !== 'nowrap') meldingen.push(`${naamPad}: flex-wrap '${n.wrap}' wordt niet gemapt — Figma kent layoutWrap, de mapping bestaat nog niet`);
    if (n.alignContent && n.alignContent !== 'flex-start' && n.alignContent !== 'normal')
      meldingen.push(`${naamPad}: align-content '${n.alignContent}' wordt niet gemapt — telt alleen bij wrap`);
    const P = n.padding ?? [0, 0, 0, 0], PV = n.paddingVar ?? [];
    f.paddingTop = P[0]; f.paddingRight = P[1]; f.paddingBottom = P[2]; f.paddingLeft = P[3];
    ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach((veld, i) => {
      if (PV[i] && V.get(PV[i])) f.setBoundVariable(veld, V.get(PV[i]));
    });
    if (n.gap) { f.itemSpacing = n.gap; if (n.gapVar && V.get(n.gapVar)) f.setBoundVariable('itemSpacing', V.get(n.gapVar)); }
  } else f.layoutMode = 'NONE';
  f.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));

  // Volgorde: een gradient overschrijft de vlakke achtergrond, zoals background-image dat
  // in CSS ook doet. Beide tegelijk is hoe de browser het rendert (kleur onder, verloop
  // erover), dus dat stapelen we ook zo.
  const vullingen = [];
  if (n.bg) {
    const p = { type: 'SOLID', color: rgb(n.bg), opacity: n.bg.a };
    vullingen.push(n.bgVar && V.get(n.bgVar)
      ? figma.variables.setBoundVariableForPaint(p, 'color', V.get(n.bgVar)) : p);
    if (!n.bgVar) meldingen.push(`${naamPad}: achtergrond ongebonden`);
  }
  if (n.grad) vullingen.push(gradientPaint(n.grad, naamPad));
  else if (n.gradientRuw) meldingen.push(`${naamPad}: gradient niet ontleed (${n.gradientRuw.slice(0, 40)})`);

  /**
   * Een absoluut kind dat de ouder volledig bedekt en alléén een vulling draagt, is in CSS
   * een achtergrondlaag — geen element náást de inhoud. In RN is dat het patroon
   * `StyleSheet.absoluteFillObject`, en RowTrack gebruikt het voor elke LinearGradient.
   *
   * Zonder deze tak belandt zo'n node als gewoon auto-layout-kind in de rij: gemeten
   * 2026-09-07 stond de rode verloop-pill daardoor NAAST het Button-label in plaats van
   * erachter, en liep de inhoud buiten de wrapper. Het viel pas op toen de gradients
   * überhaupt een vulling kregen — daarvóór was de node onzichtbaar leeg.
   *
   * Figma tekent `fills` van onder naar boven en áchter de kinderen, dus de vulling van de
   * overlay hoort in de fills-stapel van de ouder, ná diens eigen achtergrond.
   */
  // Meet tegen de CONTENT-box, niet de border-box: een absoluut kind met inset 0 valt
  // binnen de rand van zijn ouder. Gemeten op Button primary lg: ouder 153,05x44 met een
  // rand van 1, gradient 151,05x42 op dx=dy=1 — precies twee keer de randbreedte kleiner.
  // Een check op `w >= ouder.w - 1` mist die dus, en dan belandt de vulling als los kind
  // in de rij in plaats van als achtergrond.
  const rand = n.border ?? 0;
  const bedekt = k => k.abs && !k.k && !k.t && (k.grad || k.bg)
    && Math.abs(k.dx ?? 0) <= rand + 0.5 && Math.abs(k.dy ?? 0) <= rand + 0.5
    && k.w >= n.w - 2 * rand - 0.5 && k.h >= n.h - 2 * rand - 0.5;
  const achtergrondKinderen = (n.k ?? []).filter(bedekt);
  const echteKinderen = (n.k ?? []).filter(k => !bedekt(k));
  for (const a of achtergrondKinderen) {
    if (a.bg) {
      const p = { type: 'SOLID', color: rgb(a.bg), opacity: a.bg.a };
      vullingen.push(a.bgVar && V.get(a.bgVar)
        ? figma.variables.setBoundVariableForPaint(p, 'color', V.get(a.bgVar)) : p);
    }
    if (a.grad) vullingen.push(gradientPaint(a.grad, `${naamPad}(achtergrond)`));
  }
  f.fills = vullingen;
  if (n.border) {
    const p = { type: 'SOLID', color: rgb(n.borderKleur), opacity: n.borderKleur.a };
    f.strokes = n.borderKleurVar && V.get(n.borderKleurVar)
      ? [figma.variables.setBoundVariableForPaint(p, 'color', V.get(n.borderKleurVar))] : [p];
    f.strokeAlign = 'INSIDE';
    /**
     * RANDEN PER ZIJDE. `strokeWeight` is één getal voor de hele node; een scheidingslijn
     * (`0/0/1/0`) en een lijn boven en onder (`1/0/1/0`) vragen de vier losse velden.
     * Volgorde is niet vrij: `strokeWeight` schrijven ZET DE VIER TERUG, dus de losse velden
     * gaan er altijd achteraan. Wat de losse velden bindbaar maakt is `strokeAlign = INSIDE`
     * — die staat hierboven, vóór de toewijzing, met opzet.
     */
    const zijVelden = ['strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'];
    f.strokeWeight = n.border;
    let perZijde = false;
    if (n.borderZijden) {
      try {
        n.borderZijden.forEach((w, i) => { f[zijVelden[i]] = w; });
        perZijde = true;
      } catch (e) {
        // Een halve toewijzing is erger dan geen: `strokeWeight` terug, zodat de node de
        // toestand heeft die de melding beschrijft.
        f.strokeWeight = n.border;
        meldingen.push(`${naamPad}: rand per zijde ${JSON.stringify(n.borderZijden)} geweigerd (${e.message}) — volle doos gezet`);
      }
    }
    if (n.borderVar && V.get(n.borderVar)) {
      // Binden ná het zetten, en per gezette zijde: één binding op `strokeWeight` zou de
      // vier losse breedtes opnieuw gelijktrekken.
      try {
        if (perZijde) n.borderZijden.forEach((w, i) => { if (w > 0) f.setBoundVariable(zijVelden[i], V.get(n.borderVar)); });
        else f.setBoundVariable('strokeWeight', V.get(n.borderVar));
      } catch (e) { meldingen.push(`${naamPad}: randbreedte niet te binden (${e.message})`); }
    }
    if (!n.borderKleurVar) meldingen.push(`${naamPad}: randkleur ongebonden`);
    // Figma's `strokes` is één verfarray voor de hele node. Gemeten 2026-09-09: 0 van 333
    // nodes met meer dan één kleur op hun gezette zijden — de melding is de wachtpost die
    // voorkomt dat de eerste kleur er stil voor doorgaat als dat verandert.
    if (n.randKleurRest) meldingen.push(`${naamPad}: randkleuren verschillen per zijde — Figma kent maar één strokes-array, de eerste kleur is gezet`);
  }
  if (n.radius) {
    const [tl, tr, br, bl] = n.radius;
    f.topLeftRadius = tl; f.topRightRadius = tr; f.bottomRightRadius = br; f.bottomLeftRadius = bl;
    if (n.radiusVar && V.get(n.radiusVar))
      for (const veld of ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'])
        f.setBoundVariable(veld, V.get(n.radiusVar));
  }
  if (n.opacity !== undefined) f.opacity = n.opacity;
  if (n.schaduwStyle && ES.get(n.schaduwStyle)) await f.setEffectStyleIdAsync(ES.get(n.schaduwStyle).id);
  const aangehangen = [];
  for (const [i, k] of echteKinderen.entries()) {
    const kind = await maak(k, `${naamPad}>${k.naam ?? i}`, wortelComp);   // meldingen lezen als Chip>row>value
    f.appendChild(kind);
    // Een absoluut kind dat de ouder NIET volledig bedekt blijft een echte node, maar valt
    // buiten de stroom — anders duwt hij de auto-layout uit elkaar.
    if (k.abs) {
      try { if (f.layoutMode !== 'NONE') kind.layoutPositioning = 'ABSOLUTE'; } catch (e) { /* geen auto-layout */ }
      kind.x = k.dx ?? 0;
      kind.y = k.dy ?? 0;
    }
    aangehangen.push({ kind, k, pad: `${naamPad}>${k.naam ?? i}` });
  }
  zetRek(f, aangehangen, naamPad);
  if (n.t) f.appendChild(await maak({ ...n, k: null, naam: 'label' }, `${naamPad}>label`, wortelComp));
  return f;
}

/** Wrapper op de app-achtergrond: alpha-kleuren lezen anders op Figma's witte canvas. */
/**
 * De app-achtergrond hoort ACHTER de component, niet erin.
 *
 * Tot 2026-09-08 kreeg elke variant-component hier `bg/base` als eigen vulling, zodat
 * alpha-kleuren in dit bestand tegen de app-achtergrond lezen in plaats van tegen Figma's
 * grijze canvas. Dat klopt voor een bewijsstuk en is fout voor een library: die vulling reist
 * mee naar élke instance. Gemeten in `RowTrack - Design`: een Button-instance uit de library
 * gaf `instanceFills: 1` — een ondoorzichtig donker vlak om de knop, ook al is de
 * set-achtergrond in dít bestand netjes. De set-vulling komt niet mee met een variant.
 *
 * De achtergrond staat nu op de SET (die schildert achter zijn varianten en reist niet mee)
 * of op een `achtergrond`-rechthoek achter een losse component. Zelfde beeld hier,
 * transparante instance daar. Parity raakt dit niet: die meet het KIND van de wrapper.
 */
function wrapper(naam, w, h) {
  const c = figma.createComponent();
  c.name = naam;
  c.resize(Math.max(0.01, w), Math.max(0.01, h));
  c.fills = [];
  return c;
}

/** Zelfde als `wrapper`, maar een FRAME — voor schermen, die niets instantieerbaars zijn. */
function frameWrapper(naam, w, h) {
  const f = figma.createFrame();
  f.name = naam;
  f.resize(Math.max(0.01, w), Math.max(0.01, h));
  f.fills = [bgPaint()];   // een scherm heeft wél zijn eigen achtergrond: hij staat los
  f.clipsContent = true;
  return f;
}

/** Een gebonden paint met de app-achtergrond. */
function bgPaint() {
  const p = { type: 'SOLID', color: { r: 0.0824, g: 0.0902, b: 0.1098 } };
  return BG ? figma.variables.setBoundVariableForPaint(p, 'color', BG) : p;
}

/**
 * Een achtergrondvlak ACHTER een losse component, voor pagina's zonder component set.
 *
 * Een COMPONENT_SET is zelf een frame en schildert zijn vulling achter zijn varianten, dus
 * daar volstaat de set. Een losse component heeft die ouder niet en zou op Figma's grijze
 * canvas staan, waar alpha-kleuren verkeerd lezen.
 *
 * Waarom geen `page.backgrounds`: die accepteert geen variabele — *"in set_backgrounds: page
 * backgrounds cannot be bound to variables"*, gemeten 2026-09-08. Dat zou de app-achtergrond
 * een hardcoded hex maken, precies wat de tokenregel verbiedt. Een RECTANGLE bindt wél.
 */
function achtergrondVlak(page, doelen) {
  const marge = 48;
  const x0 = Math.min(...doelen.map(d => d.x)) - marge;
  const y0 = Math.min(...doelen.map(d => d.y)) - marge;
  const x1 = Math.max(...doelen.map(d => d.x + d.width)) + marge;
  const y1 = Math.max(...doelen.map(d => d.y + d.height)) + marge;
  const r = figma.createRectangle();
  r.name = 'achtergrond';
  r.x = x0; r.y = y0;
  r.resize(Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  r.fills = [bgPaint()];
  r.locked = true;
  page.appendChild(r);
  page.insertChild(0, r);      // achter alles
  return r;
}

/**
 * Vingerafdruk van een gebouwde deelboom. Bewust grof: pad, type, naam, afgeronde maat en
 * de tekstinhoud. Dat is genoeg om HANDWERK te zien (iets hernoemd, verplaatst, hertypt,
 * toegevoegd of weggehaald) zonder rood te worden op subpixel-ruis die Figma zelf
 * introduceert bij een herbouw.
 */
function bouwhash(node) {
  // Elk deel draagt zijn PAD in de boom. De vorige versie duwde de nodes op een stapel en
  // sorteerde de strings — daardoor was de hash een multiset zonder ouder-kindrelatie en
  // zonder broervolgorde, en waren precies de meest voorkomende handmatige Figma-edits
  // onzichtbaar. Gemeten 2026-09-08 op de echte functie: twee broers omdraaien, een tekstnode
  // naar een ander frame slepen en twee zusternamen omwisselen gaven alle drie een IDENTIEKE
  // hash, dus `poort()` liet ze door en de builder leegde de pagina. Broervolgorde ís de
  // visuele volgorde in een auto-layout.
  //
  // Een diepte-eerst wandeling is al deterministisch, dus het sorteren was niet alleen
  // destructief maar ook overbodig.
  const delen = [];
  (function loop(n, pad) {
    delen.push(`${pad}|${n.type}|${n.name}|${Math.round(n.width)}x${Math.round(n.height)}` +
               (n.type === 'TEXT' ? '|' + n.characters : ''));
    if ('children' in n) n.children.forEach((k, i) => loop(k, `${pad}/${i}`));
  })(node, '');
  // FNV-1a; geen crypto nodig, en deterministisch in de plugin-sandbox.
  let h = 0x811c9dc5;
  const str = delen.join('\n');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + ':' + delen.length;
}

/**
 * De poort die vóór het legen van een pagina draait. Twee redenen om te weigeren, allebei
 * gemeten op 2026-09-08:
 *
 *  · GEPUBLICEERD. De builder verwijdert elke node en maakt hem opnieuw; een nieuwe node
 *    heeft een nieuwe key en is niet gepubliceerd. Alle 33 componenten stonden daardoor op
 *    UNPUBLISHED, en elke instance die iemand uit de library had geplaatst zou gebroken zijn.
 *    Sinds het bestand als library dient, is overschrijven dus niet meer gratis.
 *  · HANDWERK. `description` zei al "niet met de hand bewerken", maar dat is een verzoek,
 *    geen mechanisme. De bouwhash uit de vorige run maakt er een meting van.
 *
 * `SPEC.__force === true` is de enige ontsnapping, en die hoort zichtbaar in de aanroep te
 * staan — nooit stil gezet.
 */
/**
 * De poort kreeg op 2026-09-09 een tweede vraag. Tot dan was hij eenvoudig: is een kind
 * gepubliceerd, dan breekt een herbouw elke instance eruit — dus weigeren. Sinds de builder
 * de COMPONENT- en VARIANT-nodes HERGEBRUIKT en alleen hun inhoud vervangt, klopt die
 * premisse niet meer: de key blijft, dus de instances blijven gekoppeld en er is niets te
 * beschermen. De poort weigert daarom alleen nog wanneer de node ECHT vervangen wordt — als
 * er geen bruikbare set/variant staat om te hergebruiken.
 *
 * De handwerk-bewaking blijft onvoorwaardelijk: een bewerking van iemand anders gaat ook bij
 * hergebruik verloren, want de kinderen worden hoe dan ook opnieuw gemaakt.
 */
async function poort(page, comp, force, hergebruikMogelijk) {
  const bezwaren = [];
  for (const kind of page.children) {
    if (typeof kind.getPublishStatusAsync === 'function' && !hergebruikMogelijk) {
      const status = await kind.getPublishStatusAsync();
      if (status !== 'UNPUBLISHED') bezwaren.push(`${comp}/${kind.name}: ${status} — deze node wordt VERVANGEN (geen bruikbare variant om te hergebruiken), dus elke instance eruit ontkoppelt`);
    }
    const vorige = typeof kind.getPluginData === 'function' ? kind.getPluginData('bouwhash') : '';
    if (vorige) {
      const nu = bouwhash(kind);
      if (nu !== vorige) bezwaren.push(`${comp}/${kind.name}: met de hand gewijzigd sinds de laatste bouw (${vorige} -> ${nu})`);
    }
  }
  if (bezwaren.length && !force) return bezwaren;
  if (bezwaren.length && force) for (const b of bezwaren) meldingen.push(`GEFORCEERD OVERSCHREVEN — ${b}`);
  return null;
}

/**
 * SCHERM-MODUS. `SPEC.__doelPagina` zet alle entries op ÉÉN pagina, als gewone FRAMEs.
 *
 * Een scherm is geen herbruikbaar ding: er hoeft niets van geïnstantieerd te worden, dus het
 * wordt geen COMPONENT en geen COMPONENT_SET. Dat heeft een tweede gevolg dat de poort merkt —
 * een FRAME heeft geen `getPublishStatusAsync`, dus een schermherbouw kan per constructie geen
 * gepubliceerde node vervangen en kost niets.
 */
const DOEL = SPEC.__doelPagina ?? null;
let doelPagina = null;
if (DOEL) {
  doelPagina = figma.root.children.find(p => p.name === DOEL);
  if (!doelPagina) { doelPagina = figma.createPage(); doelPagina.name = DOEL; }
}
// Beginnen waar de pagina al eindigt: de schermen worden PER FRAME gebouwd (elke bouw moet
// binnen de 30 s wachtlimiet van figma_execute afgerond zijn, want een netwerk-import
// overleeft dat venster niet — gemeten 2026-09-09: fire-and-forget bleef hangen op de eerste
// `importComponentByKeyAsync`, dezelfde aanroep awaited duurde 39 ms). Zonder deze offset
// stapelt elke aanroep zijn frame op x=0.
let doelX = doelPagina
  ? doelPagina.children.reduce((m, c) => Math.max(m, c.x + c.width + 48), 0)
  : 0;

/**
 * NA HET BOUWEN: is elke instance getrouw?
 *
 * Een instance draagt de library-variant. Wat als variant-as of tekst-slot is uitgedrukt reist
 * mee, en de gemeten layout zetten we er als override op — maar daarbuiten blijft er van alles
 * over dat het scherm anders rendert dan de story: de `items` van een WheelPicker, het icoon van
 * een Button, en bij een Modal-component zelfs de hele hostketen (die nest dan dubbel).
 *
 * De vraag "is deze instance getrouw" is niet vooraf te beantwoorden maar wél achteraf te METEN,
 * en pas ná het aanhangen: in een auto-layout krijgt een node zijn definitieve maat van zijn
 * ouder. Deze pas loopt de gebouwde boom naast de spec en vervangt elke instance die niet klopt
 * door de letterlijk nagebouwde subboom — mét melding. Zo is een instance een BEWERING die
 * getoetst is, en geen hoop.
 *
 * Dezelfde velden en dezelfde tolerantie als `scripts/geometry-parity.mjs`, zodat wat hier
 * doorkomt daar per constructie groen is.
 */
const TOL = 0.5;
async function toetsInstances(figNode, specNode, naamPad, wortelComp) {
  if (figNode.type === 'INSTANCE') {
    const def = INST[specNode.component];
    let x = figNode;
    for (let i = 0; i < 1 + (def?.diepte ?? 0) && 'children' in x && x.children.length; i++) x = x.children[0];
    const P = specNode.padding ?? [0, 0, 0, 0];
    const mis = [];
    if (Math.abs(x.height - (specNode.h ?? 0)) > TOL) mis.push(`hoogte ${Math.round(x.height * 100) / 100} tegen ${specNode.h}`);
    if (Math.abs((x.paddingLeft ?? 0) - P[3]) > TOL) mis.push(`paddingLeft ${x.paddingLeft ?? 0} tegen ${P[3]}`);
    if (Math.abs((x.paddingRight ?? 0) - P[1]) > TOL) mis.push(`paddingRight ${x.paddingRight ?? 0} tegen ${P[1]}`);
    if (Math.abs((x.itemSpacing ?? 0) - (specNode.gap ?? 0)) > TOL) mis.push(`gap ${x.itemSpacing ?? 0} tegen ${specNode.gap ?? 0}`);
    const echte = (specNode.k ?? []).filter(k => !bedektIn(specNode)(k));
    const figK = ('children' in x ? x.children.length : 0);
    if (figK !== echte.length) mis.push(`kinderen ${figK} tegen ${echte.length}`);
    // Óók naar binnen kijken. Een WheelPicker met een andere `items`-lijst heeft dezelfde
    // wortelmaat maar een scrollinhoud van 2000 in plaats van 4400 — dat verschil zit drie
    // niveaus diep en een wortelvergelijking ziet het niet.
    if (!mis.length) { const d = diepVerschil(x, specNode, ''); if (d) mis.push(d); }
    if (mis.length) {
      meldingen.push(`${naamPad}: instance van ${specNode.component} wijkt af (${mis.join(', ')}) — subboom nagebouwd`);
      const ouder = figNode.parent, idx = ouder.children.indexOf(figNode);
      const abs = figNode.layoutPositioning, px = figNode.x, py = figNode.y;
      const vervang = await maak({ ...specNode, component: null }, naamPad, wortelComp);
      ouder.insertChild(idx, vervang);
      figNode.remove();
      try { if (abs === 'ABSOLUTE') { vervang.layoutPositioning = 'ABSOLUTE'; vervang.x = px; vervang.y = py; } } catch (e) { /* geen auto-layout */ }
      // De VERVANGING is zelf weer gebouwd, dus er kunnen nieuwe instances in zitten die nog
      // niemand getoetst heeft. Gemeten 2026-09-09: de Button in een nagebouwde
      // MotivationalToast bleef zo als afwijkende instance staan.
      return 1 + await toetsInstances(vervang, { ...specNode, component: null }, naamPad, wortelComp);
    }
    return 0;
  }
  if (!('children' in figNode)) return 0;
  const echte = (specNode.k ?? []).filter(k => !bedektIn(specNode)(k));
  let n = 0;
  for (let i = 0; i < Math.min(figNode.children.length, echte.length); i++)
    n += await toetsInstances(figNode.children[i], echte[i], `${naamPad}>${echte[i].naam ?? i}`, wortelComp);
  return n;
}
/**
 * Wijkt de subboom van een instance ergens af van de spec? Geeft de eerste treffer met zijn pad,
 * of null. Dezelfde velden en tolerantie als de wortelvergelijking en als `geometry-parity.mjs`.
 */
function diepVerschil(fig, spec, pad) {
  if (!('children' in fig)) return null;
  const echte = (spec.k ?? []).filter(k => !bedektIn(spec)(k));
  if (fig.children.length !== echte.length) return `${pad || 'wortel'}: kinderen ${fig.children.length} tegen ${echte.length}`;
  for (let i = 0; i < echte.length; i++) {
    const f = fig.children[i], sp = echte[i], p2 = `${pad}>${sp.naam ?? i}`;
    // HOOGTE OP EEN TEKSTNODE alleen waar de builder hem zélf zette. Waar Figma hem bepaalt
    // (`textAutoResize: WIDTH_AND_HEIGHT`, builder.js:148-153) meet vergelijken de twee
    // tekstengines en niet de bouw — precies de uitsluiting die `geometry-parity.mjs` maakt.
    // Zonder die uitsluiting verwierp deze toets 40 van de 88 instances op tekstruis.
    const tekst = !!sp.t && !sp.k;
    const hoogteGezet = !tekst || sp.h > (sp.t.lh ?? sp.t.px * 1.35) * 1.5;
    if (hoogteGezet && Math.abs(f.height - (sp.h ?? 0)) > TOL) return `${p2}: hoogte ${Math.round(f.height * 100) / 100} tegen ${sp.h}`;
    if (Math.abs((f.opacity ?? 1) - (sp.opacity ?? 1)) > 0.01) return `${p2}: opacity ${f.opacity} tegen ${sp.opacity}`;
    const d = diepVerschil(f, sp, p2);
    if (d) return d;
  }
  return null;
}

/** Dezelfde opvouwregel als `maak` gebruikt (builder.js, achtergrondkinderen). */
function bedektIn(n) {
  const rand = n.border ?? 0;
  return (k) => k.abs && !k.k && !k.t && (k.grad || k.bg)
    && Math.abs(k.dx ?? 0) <= rand + 0.5 && Math.abs(k.dy ?? 0) <= rand + 0.5
    && k.w >= n.w - 2 * rand - 0.5 && k.h >= n.h - 2 * rand - 0.5;
}

const uit = [];
const geweigerd = [];
let vervangen = 0;
// Hoeveel component-/variant-nodes hun key hielden. 0 betekent: elke instance is ontkoppeld.
let hergebruikt = 0;
for (const [comp, d] of Object.entries(SPEC)) {
  if (comp.startsWith('__')) continue;   // __force en andere vlaggen zijn geen component
  let page = doelPagina;
  if (!page) {
    page = figma.root.children.find(p => p.name === comp);
    if (!page) { page = figma.createPage(); page.name = comp; }
  }
  // Hergebruik-detectie MOET vóór de poort: zijn set en varianten terug te vinden, dan
  // vervangt deze bouw geen enkele gepubliceerde node en heeft de poort niets te weigeren.
  const namenNu = (d.frames ?? d.varianten ?? []).map(v => v.naam);
  const bestaandeSet = DOEL ? null : (page.children.find(c => c.type === 'COMPONENT_SET')
    ?? (page.children.filter(c => c.type === 'COMPONENT').length === 1 ? page.children.find(c => c.type === 'COMPONENT') : null));
  const bestaandeNamen = bestaandeSet
    ? (bestaandeSet.type === 'COMPONENT_SET' ? bestaandeSet.children.map(v => v.name) : [bestaandeSet.name]) : [];
  const kanHergebruiken = !!bestaandeSet && namenNu.every(n => bestaandeNamen.includes(n))
    && bestaandeNamen.every(n => namenNu.includes(n));
  const bezwaren = await poort(page, comp, SPEC.__force === true, kanHergebruiken);
  if (bezwaren) { geweigerd.push(...bezwaren); continue; }
  // In scherm-modus staan er meerdere schermen op één pagina: alleen de eigen frames weg,
  // niet de buren. Buiten die modus is de pagina van dit component alleen.
  // In scherm-modus staan er meerdere schermen én meerdere frames op één pagina, en wordt er
  // PER FRAME gebouwd. Alleen de frames weghalen die deze aanroep opnieuw maakt — niet de buren
  // en niet de frames van een vorige aanroep van hetzelfde scherm.
  const teBouwen = new Set((d.frames ?? d.varianten ?? []).map(v => v.naam));

  /**
   * BEHOUD DE COMPONENT-NODE, VERVANG ZIJN INHOUD.
   *
   * Tot 2026-09-09 gooide deze stap de hele pagina leeg en maakte alles opnieuw. Dat is
   * eenvoudig en idempotent, en het kostte elke ronde hetzelfde: een nieuwe node heeft een
   * nieuwe key, dus élke instance ontkoppelt, de publicatiepoort gaat af, `__force` is nodig
   * en de library moet met de hand opnieuw gepubliceerd worden — ook wanneer er alleen een
   * padding veranderde.
   *
   * Dat hoeft niet, want alleen de key van de COMPONENT (en van elke VARIANT in een set)
   * telt voor een instance. De kinderen eronder mogen vrij vervangen worden; een instance
   * spiegelt gewoon de nieuwe inhoud. Dus: hergebruik de set en elke variant die we bij naam
   * terugvinden — dat is de variant-as-combinatie, dus een stabiele sleutel — leeg alleen
   * hun kinderen, en maak alleen wat er nog niet was.
   *
   * Wat WEL nieuw moet: een variant die er niet was (die heeft per definitie geen key om te
   * behouden) en een pagina zonder component. Wat weg moet: een variant die de spec niet
   * meer kent.
   */
  let hergebruikSet = null;
  const hergebruikVariant = new Map();
  if (!DOEL) {
    hergebruikSet = page.children.find(c => c.type === 'COMPONENT_SET')
      ?? (page.children.filter(c => c.type === 'COMPONENT').length === 1
            ? page.children.find(c => c.type === 'COMPONENT') : null);
    if (hergebruikSet) {
      const knopen = hergebruikSet.type === 'COMPONENT_SET' ? [...hergebruikSet.children] : [hergebruikSet];
      for (const v of knopen) {
        if (teBouwen.has(v.name) || (knopen.length === 1 && teBouwen.size === 1)) hergebruikVariant.set(
          teBouwen.has(v.name) ? v.name : [...teBouwen][0], v);
        else v.remove();
      }
      if (!hergebruikVariant.size) hergebruikSet = null;
    }
  }
  for (const kind of [...page.children]) {
    if (DOEL && !(kind.getPluginData('scherm') === comp && teBouwen.has(kind.getPluginData('frame')))) continue;
    if (kind === hergebruikSet || [...hergebruikVariant.values()].includes(kind)) continue;
    kind.remove();
  }
  for (const v of hergebruikVariant.values()) { for (const k of [...v.children]) k.remove(); hergebruikt++; }

  slotVangst = [];
  const isScherm = !!d.frames;
  const items = isScherm ? d.frames : d.varianten;
  const comps = [];
  let x = 0;
  for (const v of items) {
    const node = await maak(v.boom, comp, comp);
    // De wrapper is zo groot als de grootste van hoofdboom en overlays: een modal bedekt het
    // hele viewport en is dus vaak hoger dan het scherm eronder.
    const br = Math.max(v.boom.w, ...(v.overlays ?? []).map(o => o.w));
    const ho = Math.max(v.boom.h, ...(v.overlays ?? []).map(o => o.h));
    // Bestaat deze variant al, dan hergebruiken we hem — zijn key blijft dan geldig en elke
    // instance blijft gekoppeld. Hij is hierboven al leeggemaakt.
    const bestaand = hergebruikVariant.get(v.naam);
    let c;
    if (bestaand) {
      c = bestaand;
      c.name = v.naam;
      c.resize(Math.max(0.01, br), Math.max(0.01, ho));
      c.fills = [];
      c.layoutMode = 'NONE';   // schoon vertrekpunt; de auto-layout wordt hieronder gezet
    } else {
      c = DOEL ? frameWrapper(`${comp} / ${v.naam}`, br, ho) : wrapper(v.naam, br, ho);
    }
    if (DOEL) { c.setPluginData('scherm', comp); c.setPluginData('frame', v.naam); }
    if (!bestaand) { c.x = DOEL ? doelX : x; c.y = 0; page.appendChild(c); }
    c.appendChild(node);
    node.x = 0; node.y = 0;
    /**
     * DE WRAPPER KRIJGT AUTO-LAYOUT EN ZIJN KIND FILL — anders is alle sizing eronder voor
     * niets. Bewezen op een wegwerp-component (2026-09-09), tweezijdig: een instance van 224
     * naar 390 laat zijn kind op 224 staan zónder auto-layout op de wrapper, en trekt hem mee
     * naar 390 mét. `resize()` op dat kind doet niets, en `layoutMode` op een instance-wortel
     * evenmin — allebei stil, geen fout. De maat MOET dus uit de library komen.
     *
     * Alleen wanneer de wrapper even groot is als het kind. Is hij groter — dat gebeurt zodra
     * een overlay breder of hoger is dan de hoofdboom, want de wrapper is het maximum van
     * beide — dan zou FILL het kind uitrekken tot de overlay-maat en is de bouw niet langer
     * getrouw. Daar blijft het kind FIXED op zijn gemeten maat.
     */
    const past = Math.abs(node.width - br) < 0.5 && Math.abs(node.height - ho) < 0.5;
    if (past) {
      try {
        c.layoutMode = 'VERTICAL';
        c.primaryAxisSizingMode = 'FIXED';
        c.counterAxisSizingMode = 'FIXED';
        node.layoutSizingHorizontal = 'FILL';
        node.layoutSizingVertical = 'FILL';
        if (node.layoutSizingHorizontal !== 'FILL') meldingen.push(`${comp}[${v.naam}]: wrapper-FILL stil genegeerd`);
      } catch (e) { meldingen.push(`${comp}[${v.naam}]: wrapper-FILL geweigerd — ${e.message}`); }
    }
    // Een <Modal> portaleert in de DOM naar `body` en ligt dus OVER het scherm, niet erin.
    // Zo bouwen we hem ook: een los kind van de wrapper, absoluut op (0,0). Tot 2026-09-08
    // bestond hij voor de walker niet — drie ActivePhase-frames waren daardoor
    // dubbelgangers en de hele summary had nul meting.
    for (const o of v.overlays ?? []) {
      const ov = await maak(o, comp, comp);
      c.appendChild(ov);
      // Absoluut, want een portal ligt OVER het scherm en niet erin. Zonder dit zou de
      // auto-layout van de wrapper hem eronder stapelen.
      try { if (c.layoutMode !== 'NONE') ov.layoutPositioning = 'ABSOLUTE'; } catch (e) { /* geen auto-layout */ }
      ov.x = 0; ov.y = 0;
    }
    // Pas ná het aanhangen: in een auto-layout krijgt een node zijn maat van zijn ouder.
    if (DOEL && INST) {
      vervangen += await toetsInstances(c.children[0], v.boom, `${comp}[${v.naam}]`, comp);
      for (const [j, o] of (v.overlays ?? []).entries())
        if (c.children[j + 1]) vervangen += await toetsInstances(c.children[j + 1], o, `${comp}[${v.naam}]#overlay${j}`, comp);
    }
    x += Math.ceil(br) + 48;
    if (DOEL) doelX += Math.ceil(br) + 48;
    comps.push(c);
  }
  let hoofd = comps[0];
  if (DOEL) {
    // Geen set, geen slots, geen achtergrondvlak: elk frame staat op zichzelf op de
    // gedeelde pagina en draagt zijn eigen naam.
  } else if (!isScherm && Object.keys(d.assen ?? {}).length) {
    if (hergebruikSet && hergebruikSet.type === 'COMPONENT_SET') {
      // De set blijft staan (zijn key telt), nieuwe varianten schuiven erin.
      hoofd = hergebruikSet;
      for (const c of comps) if (c.parent !== hoofd) hoofd.appendChild(c);
    } else {
      hoofd = figma.combineAsVariants(comps, page);
    }
    hoofd.name = comp;
    // De SET houdt zijn gebonden vulling: die schildert achter de varianten in dit bestand
    // en reist NIET mee naar een instance — alleen de vulling van de variant zelf doet dat.
    hoofd.fills = [bgPaint()];
  } else if (isScherm) {
    hoofd.name = items[0].naam;
  }
  // ---- Component properties (slots) ----------------------------------------------------
  // De koppeling is gemeten, niet geraden: scripts/figma-build-spec.mjs zoekt de tekstnode
  // waarvan de inhoud exact gelijk is aan de waarde van de prop in de story-args, en markeert
  // hem alleen als hij PRECIES ÉÉN keer voorkomt. Dezelfde discipline als de tokenmatching.
  const slotsGezet = {};
  if (!isScherm && slotVangst.length) {
    const perSlot = new Map();
    for (const v of slotVangst) {
      if (!perSlot.has(v.slot)) perSlot.set(v.slot, []);
      perSlot.get(v.slot).push(v);
    }
    /**
     * HERGEBRUIK DE PROPERTY, MAAK HEM NIET OPNIEUW. `addComponentProperty` met een naam die al
     * bestaat werpt geen fout: Figma hernoemt stil naar `value2`, `value3`, … en de vorige
     * property blijft staan met nul nodes. Gemeten 2026-09-09 na drie herbouwen: 109
     * tekst-properties over 22 sets, 73 zonder node, allemaal met een cijfer-suffix. Figma
     * noemt zo'n property bij publicatie een "unused property" en weigert de component als
     * invalid asset — 22 van de 45 bleven ongepubliceerd. En de scherm-instances zetten hun
     * override op de EERSTE sleutel met die naam (`value#…`), dus na de publicatie zou elke
     * KPI-rij de library-default tonen. De sleutel zonder suffix is daarom de identiteit:
     * bind de nieuwe nodes daaraan, ververs de default, en verwijder daarna elke
     * tekst-property waar geen node meer naar wijst — luid, want dat is de reparatie.
     */
    const basisNaam = k => k.split('#')[0];
    for (const [slot, lijst] of perSlot) {
      try {
        const defs = hoofd.componentPropertyDefinitions ?? {};
        let propId = Object.keys(defs).find(k => defs[k].type === 'TEXT' && basisNaam(k) === slot) ?? null;
        if (propId) {
          if (defs[propId].defaultValue !== lijst[0].standaard) propId = hoofd.editComponentProperty(propId, { defaultValue: lijst[0].standaard });
        } else propId = hoofd.addComponentProperty(slot, 'TEXT', lijst[0].standaard);
        for (const v of lijst) v.node.componentPropertyReferences = { characters: propId };
        slotsGezet[slot] = { propId, nodes: lijst.length };
      } catch (e) { meldingen.push(`${comp}: component property "${slot}" mislukt — ${e.message}`); }
    }
  }
  // Wezen opruimen: een niet-VARIANT-property waar na de bouw geen node naar wijst.
  if (!isScherm && hoofd.componentPropertyDefinitions) {
    const defs = hoofd.componentPropertyDefinitions;
    const refs = {}; for (const k of Object.keys(defs)) if (defs[k].type !== 'VARIANT') refs[k] = 0;
    for (const n of hoofd.findAll(x => x.componentPropertyReferences))
      for (const id of Object.values(n.componentPropertyReferences)) if (id in refs) refs[id]++;
    for (const [k, n] of Object.entries(refs)) if (n === 0) {
      try { hoofd.deleteComponentProperty(k); meldingen.push(`${comp}: eigenschap "${k}" zonder node verwijderd`); }
      catch (e) { meldingen.push(`${comp}: component property "${k}" mislukt — verwijderen: ${e.message}`); }
    }
  }

  hoofd.description = isScherm
    ? `→ apps/rowtrack/components/${comp === 'ActivePhase' || comp === 'IdlePhase' ? 'workout/' : ''}${comp}.tsx\nScherm: representatieve frames, geen component set. Assen bewust afgeschreven — statusenums zijn in beeld niet orthogonaal.`
    : `→ apps/rowtrack/components/${comp}.tsx\nGegenereerd uit de Storybook-render; niet met de hand bewerken.`;
  // Geen set op deze pagina? Dan is er geen ouder-frame dat de app-achtergrond schildert.
  if (!DOEL && hoofd.type !== 'COMPONENT_SET') achtergrondVlak(page, page.children.filter(c => c.type === 'COMPONENT'));

  // Vingerafdruk vastleggen op elke pagina-kind, zodat de poort bij de volgende run
  // handwerk kan onderscheiden van "nog precies zoals ik hem achterliet".
  // Een lijst en geen map op naam: twee nodes op één pagina mogen dezelfde naam dragen
  // (gemeten in RowTrack - Design: twee keer `TabItem` op de pagina Components), en een map
  // op naam laat er dan stil één vallen.
  const hashes = [];
  for (const kind of page.children) {
    if (DOEL && !(kind.getPluginData('scherm') === comp && teBouwen.has(kind.getPluginData('frame')))) continue;
    if (kind.name === 'achtergrond' && kind.type === 'RECTANGLE') continue;
    const h = bouwhash(kind);
    kind.setPluginData('bouwhash', h);
    kind.setPluginData('gebouwdOp', STAMP);
    hashes.push({ naam: kind.name, id: kind.id, hash: h });
  }

  uit.push({ component: comp, type: hoofd.type, id: hoofd.id, nodes: comps.length,
             assen: hoofd.type === 'COMPONENT_SET' ? hoofd.variantGroupProperties : null,
             // Een FRAME heeft geen `getPublishStatusAsync` — dat is precies waarom een scherm
             // de publicatiepoort niet raakt, en het bijt hier in de rapportage.
             publishStatus: typeof hoofd.getPublishStatusAsync === 'function'
               ? await hoofd.getPublishStatusAsync() : null,
             hashes,
             slots: Object.keys(slotsGezet).length ? slotsGezet : null });
}
return { gebouwd: uit, geweigerd, vervangen, hergebruikt, rekGezet, rekTeruggedraaid, rekGeweigerd, aantalMeldingen: meldingen.length, ...telPerSoort(meldingen), meldingen: meldingen.slice(0, 12) };
