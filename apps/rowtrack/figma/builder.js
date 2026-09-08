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

async function maak(n, naamPad) {
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
      ph.name = `Icon ${Math.round(n.t.px)}`;
      ph.resize(Math.max(1, n.w), Math.max(1, n.h));
      ph.fills = [];
      ph.strokes = [{ type: 'SOLID', color: { r: 0.94, g: 0.33, b: 0.33 }, opacity: 0.4 }];
      ph.strokeWeight = 1; ph.dashPattern = [2, 2]; ph.cornerRadius = 2;
      meldingen.push(`${naamPad}: icoon ${n.t.px}px als placeholder (geen Figma-font)`);
      return ph;
    }
    const t = figma.createText();
    if (stijl) {
      await figma.loadFontAsync(stijl.fontName);
      t.fontName = stijl.fontName;
      t.characters = String(n.t.s);
      await t.setTextStyleIdAsync(stijl.id);
      if (n.t.tc) t.textCase = n.t.tc;
    } else {
      await figma.loadFontAsync(font);
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
    return t;
  }

  const f = figma.createFrame();
  f.name = naamPad.split('>').pop() || 'Frame';
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
    const kind = await maak(k, `${naamPad}>${i}`);
    f.appendChild(kind);
    // Een absoluut kind dat de ouder NIET volledig bedekt blijft een echte node, maar valt
    // buiten de stroom — anders duwt hij de auto-layout uit elkaar.
    if (k.abs) {
      try { if (f.layoutMode !== 'NONE') kind.layoutPositioning = 'ABSOLUTE'; } catch (e) { /* geen auto-layout */ }
      kind.x = k.dx ?? 0;
      kind.y = k.dy ?? 0;
    }
  }
  if (n.t) f.appendChild(await maak({ ...n, k: null }, `${naamPad}>tekst`));
  return f;
}

/** Wrapper op de app-achtergrond: alpha-kleuren lezen anders op Figma's witte canvas. */
function wrapper(naam, w, h) {
  const c = figma.createComponent();
  c.name = naam;
  c.resize(Math.max(0.01, w), Math.max(0.01, h));
  const p = { type: 'SOLID', color: { r: 0.0824, g: 0.0902, b: 0.1098 } };
  c.fills = BG ? [figma.variables.setBoundVariableForPaint(p, 'color', BG)] : [p];
  return c;
}

const uit = [];
for (const [comp, d] of Object.entries(SPEC)) {
  let page = figma.root.children.find(p => p.name === comp);
  if (!page) { page = figma.createPage(); page.name = comp; }
  for (const kind of [...page.children]) kind.remove();

  const isScherm = !!d.frames;
  const items = isScherm ? d.frames : d.varianten;
  const comps = [];
  let x = 0;
  for (const v of items) {
    const node = await maak(v.boom, comp);
    const c = wrapper(v.naam, v.boom.w, v.boom.h);
    c.x = x; c.y = 0;
    page.appendChild(c);
    c.appendChild(node);
    node.x = 0; node.y = 0;
    x += Math.ceil(v.boom.w) + 48;
    comps.push(c);
  }
  let hoofd = comps[0];
  if (!isScherm && Object.keys(d.assen ?? {}).length) {
    hoofd = figma.combineAsVariants(comps, page);
    hoofd.name = comp;
    const p = { type: 'SOLID', color: { r: 0.0824, g: 0.0902, b: 0.1098 } };
    hoofd.fills = BG ? [figma.variables.setBoundVariableForPaint(p, 'color', BG)] : [p];
  } else if (isScherm) {
    hoofd.name = items[0].naam;
  }
  hoofd.description = isScherm
    ? `→ apps/rowtrack/components/${comp === 'ActivePhase' || comp === 'IdlePhase' ? 'workout/' : ''}${comp}.tsx\nScherm: representatieve frames, geen component set. Assen bewust afgeschreven — statusenums zijn in beeld niet orthogonaal.`
    : `→ apps/rowtrack/components/${comp}.tsx\nGegenereerd uit de Storybook-render; niet met de hand bewerken.`;
  uit.push({ component: comp, type: hoofd.type, id: hoofd.id, nodes: comps.length,
             assen: hoofd.type === 'COMPONENT_SET' ? hoofd.variantGroupProperties : null });
}
return { gebouwd: uit, aantalMeldingen: meldingen.length, meldingen: meldingen.slice(0, 12) };
