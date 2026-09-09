#!/usr/bin/env node
/**
 * Kent elke node in de bouwspec een LAAGNAAM toe, uit de StyleSheet-sleutels van de code.
 *
 * Waarom dit een eigen module is: de beslissing valt per COMPONENT, over álle varianten
 * tegelijk. Per node kiezen loopt aantoonbaar vast — `ErrorState` stylet zijn wortel met
 * `containerSm` in de ene variant en `containerLg` in de andere, dus een per-node-keuze
 * geeft twee verschillende namen op dezelfde positie en maakt de component set onbruikbaar.
 * Door de keuze over de varianten heen te nemen is variant-stabiliteit een constructie-
 * eigenschap in plaats van een hoop.
 *
 * De kandidaten zelf komen uit de walker: per node de StyleSheet-sleutels waarvan minstens
 * één atomaire klasse op die node staat. Overlap en geen subset — `styleq` gooit
 * overschreven klassen wég, dus een basisstijl is nooit volledig aanwezig zodra een modifier
 * hem raakt (PrBadge: `badgeSm` overschrijft 4 van `badge`'s 8 properties).
 */

/** Minimale dekking (eigen klassen op de node / klassen van de sleutel) om mee te tellen. */
export const DREMPEL = 0.34;

const plat = (n, uit = []) => { uit.push(n); for (const k of n.kinderen ?? []) plat(k, uit); return uit; };
/** Boomvorm als string — twee varianten met dezelfde vorm zijn positie-voor-positie vergelijkbaar. */
const vorm = (n) => `${(n.kinderen ?? []).length}(${(n.kinderen ?? []).map(vorm).join('')})`;
const sleutelId = (c) => `${c.b}/${c.s}`;

/**
 * Bestandspad -> componentnaam, voor de "genest component"-tak.
 *
 * Een `.stories.tsx` is géén componentbron: die stript maar één extensie en leverde daardoor
 * laagnamen als `BottomSheet.stories` en `Skeleton.stories` (gemeten 2026-09-08).
 */
function componentVan(bron) {
  const blad = bron.split('/').pop();
  if (/\.stories\.tsx?$/.test(blad)) return null;
  const naam = blad.replace(/\.tsx?$/, '');
  return /^[A-Z]/.test(naam) && !naam.includes('.') ? naam : null;
}

/**
 * Vouw variant-alternatieven samen tot één stamnaam — met POSITIEF bewijs.
 *
 * De vorige versie vouwde elk paar sleutels dat nooit samen op één node stond. Dat is een
 * negatief bewijs, en het bewijst het verkeerde: twee sleutels die op twee verschillende
 * ELEMENTEN zitten botsen per constructie ook nooit. Gemeten 2026-09-08 op de gecommitte
 * spec: `smallValue`/`smallUnit` uit WheelPicker werden `small`/`small`, en er stonden
 * **295 ouders met twee of meer identieke kindnamen** in (`small` 128×, `kpi` 90×,
 * `overlay` 80×, `big` 64×) — plus `scr`, een niet-bestaand woord uit `screen`+`scrollView`.
 * `valueRow > small / small` draagt niet meer informatie dan `0 / 1`.
 *
 * Het bewijs dat er wél toe doet: twee sleutels zijn alternatieven wanneer ze om de beurt op
 * DEZELFDE POSITIE in de boom winnen, in verschillende varianten. Dat is precies wat een
 * ternary doet (`size === 'lg' ? containerLg : containerSm`) en wat twee zusjes nooit doen.
 *
 * @param bomen    alle varianten, met een rauwe winnaar (`ruw`) per node
 */
function vouwAlternatieven(bomen, meta) {
  // Alleen varianten met dezelfde boomvorm zijn positie-voor-positie vergelijkbaar.
  const groepen = new Map();
  for (const b of bomen) {
    const v = vorm(b);
    if (!groepen.has(v)) groepen.set(v, []);
    groepen.get(v).push(b);
  }

  const paren = new Set();
  for (const [, g] of groepen) {
    if (g.length < 2) continue;
    const rijen = g.map(b => plat(b));
    for (let i = 0; i < rijen[0].length; i++) {
      const winnaars = [...new Set(rijen.map(r => r[i].ruw).filter(Boolean))];
      for (let a = 0; a < winnaars.length; a++)
        for (let b = a + 1; b < winnaars.length; b++) paren.add([winnaars[a], winnaars[b]].sort().join('|'));
    }
  }

  // Botsen ze tóch ergens samen op één node, dan is het een array-compositie
  // (`[styles.badge, small && styles.badgeSm]`) en geen alternatief.
  const botst = new Set();
  for (const b of bomen)
    for (const n of plat(b)) {
      const k = n.kandidaten ?? [];
      for (let i = 0; i < k.length; i++)
        for (let j = i + 1; j < k.length; j++) {
          const x = k[i], y = k[j];
          if (x.b !== y.b) continue;
          const xEigen = x.eigen.filter((c) => !y.eigen.includes(c));
          const yEigen = y.eigen.filter((c) => !x.eigen.includes(c));
          if (xEigen.length && yEigen.length) botst.add([sleutelId(x), sleutelId(y)].sort().join('|'));
        }
    }

  const vouw = new Map();
  for (const paar of paren) {
    if (botst.has(paar)) continue;
    const [a, b] = paar.split('|');
    const ma = meta.get(a), mb = meta.get(b);
    if (!ma || !mb || ma.b !== mb.b) continue;          // verschillende bronbestanden: geen paar
    const stam = gedeeldeStam(ma.s, mb.s);
    if (!stam) continue;
    vouw.set(a, stam); vouw.set(b, stam);
  }
  return vouw;
}

/**
 * De naam die twee alternatieven samen dragen, of null.
 *
 * Twee vormen, allebei in deze codebase:
 *  · gedeeld VOORVOEGSEL — `containerLg`/`containerSm` -> `container`, `titleLg`/`titleSm`
 *  · gedeeld ACHTERVOEGSEL — `ghostText`/`outlineText`/`text` -> `text`. Hier is de kortste
 *    naam de basis, en die is precies wat de laag ís; het voorvoegsel is de variant.
 * `band`/`filled` (Segmented) deelt geen van beide en valt bewust door naar de terugval —
 * er bestaat geen naam die ze allebei beschrijft.
 */
function gedeeldeStam(a, b) {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  if (p >= 3) {
    const stam = a.slice(0, p).replace(/[A-Z]+$/, '');   // "containerL" -> "container"
    if (stam.length >= 3) return stam;
  }
  const [kort, lang] = a.length <= b.length ? [a, b] : [b, a];
  if (kort.length >= 3 && lang.toLowerCase().endsWith(kort.toLowerCase())) return kort;
  return null;
}

/**
 * Maak de namen per positie gelijk over isomorfe varianten.
 *
 * Dit is de GARANTIE achter de `naam-stabiliteit`-as, en hij staat er omdat de vouwregel
 * hem niet kan geven. Drie oorzaken die overblijven, alle drie gemeten:
 *  · alternatieven zonder gedeelde stam — `dot` tegen `icon` in DeviceRow;
 *  · een modifier die zijn basis zó ver overschrijft dat de basis onder de drempel valt —
 *    `valueCompact` verdringt `value` in KPI;
 *  · een variant waarin een sleutel toevallig één klasse meer verklaart.
 * De meest voorkomende naam wint, gelijkspel alfabetisch, zodat de uitkomst deterministisch
 * is. Elke node die hier verschuift krijgt `naamGestabiliseerd`, zodat het telbaar blijft in
 * plaats van te verdwijnen in een gelijk getal.
 */
export function stabiliseer(bomen) {
  const groepen = new Map();
  for (const b of bomen) {
    const v = vorm(b);
    if (!groepen.has(v)) groepen.set(v, []);
    groepen.get(v).push(b);
  }
  let verschoven = 0, posities = 0;
  for (const [, g] of groepen) {
    if (g.length < 2) continue;
    const rijen = g.map(b => plat(b));
    for (let i = 0; i < rijen[0].length; i++) {
      const tel = new Map();
      for (const r of rijen) tel.set(r[i].naam, (tel.get(r[i].naam) ?? 0) + 1);
      if (tel.size < 2) continue;
      // Een naam uit de DOM — `data-testid`, `data-laag` of een herkende rnw-hostlaag — is een
      // FEIT, geen sleutelgok. Hem naar een meerderheid gladstrijken spreekt de bron tegen die
      // hem heeft opgeleverd.
      if (rijen.some(r => ['rnw', 'testid', 'laag'].includes(r[i].naamBron))) continue;
      posities++;
      const winnaar = [...tel.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
      for (const r of rijen) if (r[i].naam !== winnaar) { r[i].naam = winnaar; r[i].naamGestabiliseerd = true; verschoven++; }
    }
  }
  return { verschoven, posities };
}

/**
 * Terugvalnaam wanneer geen enkele sleutel de node verklaart.
 *
 * De volgorde is niet willekeurig: eerst wat de node ÍS (een icoon, een rol, tekst), dan pas
 * wat zijn plaats in de layout is. `positie === 'absolute'` stond hier eerst bovenaan en gaf
 * 2 125 nodes de naam `overlay` — terwijl het de rijen van de WheelPicker waren, die
 * absoluut gepositioneerd zijn omdat Reanimated ze transformeert. Een structurele
 * eigenschap is geen rol; alleen een absolute node die zijn ouder BEDEKT is een overlay.
 */
function terugval(n, ouder) {
  if (n.bevatSvg || n.tekst?.family?.toLowerCase().includes('ionicons')) return ['icon', 'rol'];
  const rolKaart = { button: 'button', heading: 'heading', progressbar: 'progressbar',
                     img: 'image', list: 'list', switch: 'switch', link: 'link' };
  if (n.rol && rolKaart[n.rol]) return [rolKaart[n.rol], 'rol'];
  // `node.tekst.styleRef`, niet `node.styleRef`: de walker schrijft hem ín het tekst-object
  // (figma-build-spec.mjs). De vorige versie las het top-niveau, dus deze tak viel altijd
  // door naar 'label' en geen enkele tekstnode kreeg ooit zijn text-style-naam.
  if (n.tekst) { const ref = n.tekst.styleRef ?? n.styleRef; return [ref ? ref.split('/').pop() : 'label', 'rol']; }
  if (n.positie === 'absolute' && ouder && n.w >= ouder.w - 1 && n.h >= ouder.h - 1)
    return ['overlay', 'terugval'];
  const kinderen = n.kinderen?.length ?? 0;
  if (kinderen === 0) return ['item', 'terugval'];
  if (kinderen === 1) return ['wrapper', 'terugval'];
  return [n.richting === 'row' ? 'row' : 'col', 'terugval'];
}

/**
 * @param {string} comp        componentnaam (wordt de naam van de wortel)
 * @param {object[]} bomen     de boom van elke variant
 */
export function benoem(comp, bomen) {
  // Universeel = de sleutel komt in ELKE variant ergens boven de drempel voor. Een
  // universele sleutel is de identiteit van het element, een conditionele de modifier —
  // en de modifier is precies wat de variant-as al uitdrukt.
  const universaliteit = (vouw) => {
    const perVariant = bomen.map(b => new Set(
      plat(b).flatMap(n => (n.kandidaten ?? [])
        .filter(c => c.eigen.length / c.n >= DREMPEL)
        .map(c => vouw.get(sleutelId(c)) ?? sleutelId(c)))));
    return new Set([...(perVariant[0] ?? [])].filter(s => perVariant.every(p => p.has(s))));
  };
  /**
   * `o` — komt deze sleutel uit het bestand van het component dat deze node OMSLUIT?
   *
   * Hij staat als EERSTE sorteersleutel, niet als tiebreaker. Als tiebreaker zou hij alleen de
   * exacte gelijkspelen oplossen; als eerste sleutel verslaat een sleutel binnen de verklaarde
   * grens óók een vreemde sleutel met hógere dekking. Dat laatste is de bron van de ambigue
   * namen: atomaire klassen zijn globaal gedeeld over élke `StyleSheet.create` in de
   * preview-iframe, dus `doelPillValueRow` in ActivePhase won `row` uit Chip.tsx.
   *
   * De grens komt uit `data-testid` (een feit), niet uit `naamBronId` — dat is zelf een gok.
   */
  const rangschik = (n, vouw, universeel) => (n.kandidaten ?? [])
    .map(c => {
      const id = sleutelId(c);
      return { ...c, id, naam: vouw.get(id) ?? c.s, cov: c.eigen.length / c.n, d: c.eigen.length,
               u: universeel.has(vouw.get(id) ?? id) ? 0 : 1,
               o: n.omsluit && c.bron.endsWith(`/${n.omsluit}.tsx`) ? 0 : 1 };
    })
    .filter(c => c.cov >= DREMPEL)
    .sort((a, b) => a.o - b.o || a.u - b.u || b.cov - a.cov || b.d - a.d || a.v - b.v);

  // VOORPAS — welk component omsluit elke node? Top-down uit de dichtstbijzijnde `data-testid`,
  // anders het story-component. Dit moet vóór pas 1, want `rangschik` gebruikt het in beide
  // passen en een verschil ertussen maakt het vouwen-bewijs onbetrouwbaar.
  const zetOmsluit = (n, erfenis) => {
    const eigen = n.component ?? erfenis;
    n.omsluit = eigen;
    for (const k of n.kinderen ?? []) zetOmsluit(k, eigen);
  };
  for (const b of bomen) zetOmsluit(b, comp);

  // PAS 1 — een rauwe winnaar per node, zonder vouwen. Die is nodig om te zien welke twee
  // sleutels om de beurt op DEZELFDE POSITIE winnen; dat is het positieve bewijs dat ze
  // alternatieven zijn, en zonder die pas is er alleen het negatieve "ze botsen nooit".
  const leeg = new Map();
  const universeelRuw = universaliteit(leeg);
  const meta = new Map();
  for (const b of bomen)
    for (const n of plat(b)) {
      const w = rangschik(n, leeg, universeelRuw)[0];
      n.ruw = w ? w.id : null;
      if (w) meta.set(w.id, w);
    }

  const vouw = vouwAlternatieven(bomen, meta);
  const universeel = universaliteit(vouw);


  // PAS 2 — opnieuw kiezen, nu mét de gevouwen namen, en daarna stabiliseren.
  for (const boom of bomen) loop(boom, null, true);
  // `stabiliseer` egaliseert precies wat de [laagnaam]-as daarna toetst (`instabiel`), dus die
  // subas kan per constructie alleen nul vinden — één meting die zichzelf bevestigt. Het
  // signaal dat de producent NIET normaliseert is hoeveel posities hij moest gladstrijken;
  // dat gaat naar figma/laagnamen.json en is daar wél een ratel.
  const stab = stabiliseer(bomen);

  function loop(n, ouder, isWortel) {
    const k = rangschik(n, vouw, universeel);
    const w = k[0];
    n.naamAmbigu = !!(w && k[1] && k[1].u === w.u && k[1].cov === w.cov && k[1].d === w.d && k[1].naam !== w.naam);

    if (isWortel) { n.naam = comp; n.naamBron = 'component'; }
    // EEN FEIT UIT DE DOM. `testID` op de componentwortel komt als `data-testid` terug
    // (react-native-web createDOMProps:831) en zegt letterlijk welk component hier begint —
    // geen sleutel-gok, geen dekkingsdrempel. `!== ouder.omsluit` sluit de zelf-nesting uit:
    // een component dat een ánder component als zijn eigen wortel rendert (BleStatusBar geeft
    // zijn naam door aan DeviceRow) heeft de grens al op de wortel staan.
    else if (n.component && n.component !== ouder?.omsluit) { n.naam = n.component; n.naamBron = 'testid'; }
    // Idem voor `dataSet={{ laag: '…' }}` op een node die Reanimated inline stylet — daar
    // bestaat geen StyleSheet-sleutel om op te matchen. Alleen camelCase telt; een andere vorm
    // is een typfout en wordt gemeld in plaats van gebruikt.
    // Welke CODE deze node rendert, als de grens erboven al door een ander component geclaimd is.
    // Dat is precies het geval waarvoor de heuristiek bestond: GoalSheet rendert een BottomSheet
    // als zijn eigen wortel en geeft daar zijn naam aan door, dus `component` is gelijk aan het
    // omsluitende component en de zelf-nesting-poort slaat hem over. `data-bron` is daar het feit.
    else if (n.bron && n.bron !== ouder?.omsluit) { n.naam = n.bron; n.naamBron = 'bron'; }
    else if (n.laag && /^[a-z][A-Za-z0-9]*$/.test(n.laag)) { n.naam = n.laag; n.naamBron = 'laag'; }
    // DOM die react-native-web zelf schrijft, herkend aan zijn eigen bron (zie `rnwRol` in
    // figma-build-spec.mjs). Dit is een FEIT over de node, geen sleutelgok — en het staat
    // hier bewust vóór de sleutelmatching. Atomaire klassen zijn globaal gedeeld, dus zonder
    // deze tak wonnen de spinner in Button de sleutel `base` en de modal-hostlagen `scrim`
    // en `root`: namen uit bestanden die die nodes niet schrijven.
    // GEDEELD (`scrollView`, `scrollContent`) valt hier NIET onder: die host is wel RNW-DOM,
    // maar draagt de app-`style` — daar wint een sleutel terecht, en de rnw-naam is de
    // terugval. Zie de tak onder `else if (w)`.
    else if (n.rnw && !n.rnwGedeeld) { n.naam = n.rnw; n.naamBron = 'rnw'; }
    else if (w) {
      n.naam = w.naam; n.naamBron = vouw.has(w.id) ? 'gefold' : 'sleutel';
    } else if (n.rnw) {
      n.naam = n.rnw; n.naamBron = 'rnw';
    } else {
      const [naam, bron] = terugval(n, ouder);
      n.naam = naam; n.naamBron = bron;
    }
    for (const kind of n.kinderen ?? []) loop(kind, n, false);
  }

  return { component: comp, gestabiliseerd: stab.verschoven, instabielePosities: stab.posities,
           // De heuristische componentgrens BESTAAT NIET MEER (2026-09-09). Het veld blijft nul
           // zodat de ratel in figma-sync-check.mjs zijn tegenproef houdt: gaat hij ooit boven
           // nul, dan is er een tak teruggekomen die raadt waar de code kan verklaren.
           heuristiek: 0, heuristiekTreffers: [] };
}

/** Meet de dekking en de variant-stabiliteit over een verzameling benoemde bomen. */
export function meet(perComponent) {
  const perBron = { sleutel: 0, gefold: 0, component: 0, testid: 0, bron: 0, laag: 0, heuristiek: 0, rnw: 0, rol: 0, terugval: 0 };
  let nodes = 0, doorvoer = 0, ambigu = 0, indexNamen = 0, copyNamen = 0, gestabiliseerd = 0, rnwNodes = 0;
  const hist = new Array(11).fill(0);
  const instabiel = [];

  for (const [comp, bomen] of Object.entries(perComponent)) {
    for (const b of bomen) for (const n of plat(b)) {
      nodes++;
      if (n.doorvoer) doorvoer++;
      // Een RNW-node is DOM die de app nergens schrijft (de cirkels van een ActivityIndicator,
      // de hostketen van een Modal). Hij kan per constructie geen code-naam krijgen en hoort
      // dus niet in de NOEMER van "hoeveel laagnamen komen uit de code" — behalve wanneer hij
      // toch een sleutel won, want dan draagt hij wél app-stijl (de ScrollView-host).
      if (n.rnw) rnwNodes++;
      perBron[n.naamBron] = (perBron[n.naamBron] ?? 0) + 1;
      if (n.naamAmbigu) ambigu++;
      if (n.naamGestabiliseerd) gestabiliseerd++;
      if (/^\d+$/.test(n.naam ?? '')) indexNamen++;
      if (n.tekst && n.naam === n.tekst.inhoud) copyNamen++;
      for (const c of n.kandidaten ?? []) hist[Math.min(10, Math.floor(c.eigen.length / c.n * 10 + 1e-9))]++;
    }
    // Stabiliteit alleen tussen ISOMORFE varianten: een conditioneel kind verandert de
    // boomvorm, en dan is een verschil in de namenlijst legitiem in plaats van een defect.
    const vorm = (n) => `${(n.kinderen ?? []).length}(${(n.kinderen ?? []).map(vorm).join('')})`;
    const namen = (n) => [n.naam, ...(n.kinderen ?? []).flatMap(namen)];
    const groepen = new Map();
    bomen.forEach((b, i) => {
      const v = vorm(b);
      if (!groepen.has(v)) groepen.set(v, []);
      groepen.get(v).push({ i, namen: namen(b).join('>') });
    });
    for (const [, g] of groepen)
      for (const x of g.slice(1))
        if (x.namen !== g[0].namen) instabiel.push({ comp, varianten: [g[0].i, x.i] });
  }

  const echt = perBron.sleutel + perBron.gefold + perBron.component + perBron.testid + perBron.bron + perBron.laag + perBron.heuristiek;
  // De EERLIJKE noemer: nodes die de app zelf schrijft. Tot 2026-09-08 stond `echteNaamPct`
  // over álle niet-doorvoer-nodes, dus 125-plus nodes die nooit een code-naam kúnnen krijgen
  // drukten het percentage permanent omlaag — een plafond dat als tekortkoming las.
  // `rnwNodes` wordt gerapporteerd maar NIET geratelt: hoeveel RNW-DOM er staat verandert
  // legitiem met elke Modal of ScrollView die erbij komt.
  const appNodes = nodes - doorvoer - perBron.rnw;
  return { nodes, doorvoer, nodesZonderDoorvoer: nodes - doorvoer, perBron, appNodes, rnwNodes,
           echteNaamPct: +(100 * echt / appNodes).toFixed(1),
           echteNaamPctRuw: +(100 * echt / (nodes - doorvoer)).toFixed(1),
           ambigu, gestabiliseerd, indexNamen, copyNamen, instabiel, dekkingHistogram: hist, drempel: DREMPEL };
}
