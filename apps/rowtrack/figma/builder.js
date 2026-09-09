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
const meldingen = [];
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
  if (!def.varianten) return { key: def.key, naam: null };
  if (!n.variant) {
    meldingen.push(`${naamPad}: ${n.component} heeft variant-assen maar geen data-variant — `
      + 'geen keuze mogelijk, subboom nagebouwd in plaats van geïnstantieerd');
    return null;
  }
  const gemeten = paren(n.variant);
  const treffers = Object.entries(def.varianten)
    .filter(([naam]) => [...paren(naam)].every(([as, w]) => gemeten.get(as) === w));
  if (treffers.length === 1) return { key: treffers[0][1], naam: treffers[0][0] };
  meldingen.push(`${naamPad}: ${treffers.length} variant(en) van ${n.component} passen op `
    + `"${n.variant}" — geen keuze, subboom nagebouwd in plaats van geïnstantieerd`);
  return null;
}

/** Plaats een library-instance voor deze node, of geef null en laat de builder hem nabouwen. */
async function maakInstance(n, naamPad) {
  const def = INST[n.component];
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

  // Slots vullen uit wat de spec op deze plek MEET. De koppeling komt uit dezelfde markering
  // die de library-bouw gebruikt: scripts/figma-build-spec.mjs zet `slot` op de tekstnode
  // waarvan de inhoud exact gelijk is aan de waarde van de prop, en alleen als hij precies
  // één keer voorkomt.
  const waarden = {};
  (function loop(x) {
    if (x.slot && x.t) waarden[x.slot] = String(x.t.s);
    for (const k of x.k ?? []) loop(k);
  })(n);
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
  return inst;
}

async function maak(n, naamPad, wortelComp) {
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
    const enkeleRegel = n.t.lh ?? n.t.px * 1.35;
    if (n.h > enkeleRegel * 1.5) {
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
  f.clipsContent = false;
  if (n.k && n.rij !== undefined) {
    f.layoutMode = n.rij ? 'HORIZONTAL' : 'VERTICAL';
    f.primaryAxisSizingMode = 'FIXED';
    f.counterAxisSizingMode = 'FIXED';
    if (n.justify === 'center') f.primaryAxisAlignItems = 'CENTER';
    if (n.justify === 'space-between') f.primaryAxisAlignItems = 'SPACE_BETWEEN';
    if (n.justify === 'flex-end') f.primaryAxisAlignItems = 'MAX';
    if (n.align === 'center') f.counterAxisAlignItems = 'CENTER';
    if (n.align === 'flex-end') f.counterAxisAlignItems = 'MAX';
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
    f.strokeWeight = n.border; f.strokeAlign = 'INSIDE';
    if (n.borderVar && V.get(n.borderVar)) f.setBoundVariable('strokeWeight', V.get(n.borderVar));
    if (!n.borderKleurVar) meldingen.push(`${naamPad}: randkleur ongebonden`);
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
  }
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
async function poort(page, comp, force) {
  const bezwaren = [];
  for (const kind of page.children) {
    if (typeof kind.getPublishStatusAsync === 'function') {
      const status = await kind.getPublishStatusAsync();
      if (status !== 'UNPUBLISHED') bezwaren.push(`${comp}/${kind.name}: ${status} — herbouwen breekt elke instance die eruit geplaatst is`);
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

const uit = [];
const geweigerd = [];
for (const [comp, d] of Object.entries(SPEC)) {
  if (comp.startsWith('__')) continue;   // __force en andere vlaggen zijn geen component
  let page = doelPagina;
  if (!page) {
    page = figma.root.children.find(p => p.name === comp);
    if (!page) { page = figma.createPage(); page.name = comp; }
  }
  const bezwaren = await poort(page, comp, SPEC.__force === true);
  if (bezwaren) { geweigerd.push(...bezwaren); continue; }
  // In scherm-modus staan er meerdere schermen op één pagina: alleen de eigen frames weg,
  // niet de buren. Buiten die modus is de pagina van dit component alleen.
  // In scherm-modus staan er meerdere schermen én meerdere frames op één pagina, en wordt er
  // PER FRAME gebouwd. Alleen de frames weghalen die deze aanroep opnieuw maakt — niet de buren
  // en niet de frames van een vorige aanroep van hetzelfde scherm.
  const teBouwen = new Set((d.frames ?? d.varianten ?? []).map(v => v.naam));
  for (const kind of [...page.children]) {
    if (DOEL && !(kind.getPluginData('scherm') === comp && teBouwen.has(kind.getPluginData('frame')))) continue;
    kind.remove();
  }

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
    const c = DOEL ? frameWrapper(`${comp} / ${v.naam}`, br, ho) : wrapper(v.naam, br, ho);
    if (DOEL) { c.setPluginData('scherm', comp); c.setPluginData('frame', v.naam); }
    c.x = DOEL ? doelX : x; c.y = 0;
    page.appendChild(c);
    c.appendChild(node);
    node.x = 0; node.y = 0;
    // Een <Modal> portaleert in de DOM naar `body` en ligt dus OVER het scherm, niet erin.
    // Zo bouwen we hem ook: een los kind van de wrapper, absoluut op (0,0). Tot 2026-09-08
    // bestond hij voor de walker niet — drie ActivePhase-frames waren daardoor
    // dubbelgangers en de hele summary had nul meting.
    for (const o of v.overlays ?? []) {
      const ov = await maak(o, comp, comp);
      c.appendChild(ov);
      ov.x = 0; ov.y = 0;
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
    hoofd = figma.combineAsVariants(comps, page);
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
    for (const [slot, lijst] of perSlot) {
      try {
        const propId = hoofd.addComponentProperty(slot, 'TEXT', lijst[0].standaard);
        for (const v of lijst) v.node.componentPropertyReferences = { characters: propId };
        slotsGezet[slot] = { propId, nodes: lijst.length };
      } catch (e) { meldingen.push(`${comp}: component property "${slot}" mislukt — ${e.message}`); }
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
return { gebouwd: uit, geweigerd, aantalMeldingen: meldingen.length, meldingen: meldingen.slice(0, 12) };
