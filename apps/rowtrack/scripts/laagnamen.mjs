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
const sleutelId = (c) => `${c.b}/${c.s}`;

/** Bestandspad -> componentnaam, voor de "genest component"-tak. */
function componentVan(bron) {
  const blad = bron.split('/').pop().replace(/\.tsx?$/, '');
  return /^[A-Z]/.test(blad) ? blad : null;
}

/**
 * Vouw variant-alternatieven samen tot één stamnaam.
 *
 * Twee sleutels uit dezelfde `create`-aanroep zijn ALTERNATIEVEN als geen enkele node ooit
 * een eigen klasse van allebei draagt. Dat scheidt een ternary (`size === 'lg' ? a : b`,
 * ErrorState) van een array (`[basis, modifier]`, PrBadge) zonder te raden: bij een array
 * staan beide sleutels tegelijk op dezelfde node, bij een ternary nooit.
 *
 * Alleen alternatieven met een gedeeld voorvoegsel van >= 3 tekens worden gevouwen — anders
 * is er geen naam die beide beschrijft (`band`/`filled` in Segmented) en valt de node door
 * naar de terugval.
 */
function vouwAlternatieven(nodes) {
  const eigenPer = new Map();          // sleutelId -> Set van klassen die alleen die sleutel heeft
  const perBron = new Map();           // bronId -> Set van sleutelIds
  const meta = new Map();              // sleutelId -> kandidaat-meta
  for (const n of nodes)
    for (const c of n.kandidaten ?? []) {
      const id = sleutelId(c);
      meta.set(id, c);
      if (!perBron.has(c.b)) perBron.set(c.b, new Set());
      perBron.get(c.b).add(id);
      if (!eigenPer.has(id)) eigenPer.set(id, new Set());
      for (const k of c.eigen) eigenPer.get(id).add(k);
    }

  // Per node: welke klassen horen bij welke sleutel? Twee sleutels "botsen" als een node
  // een klasse draagt die exclusief van A is én een klasse die exclusief van B is.
  const botst = new Set();
  for (const n of nodes) {
    const k = n.kandidaten ?? [];
    for (let i = 0; i < k.length; i++)
      for (let j = i + 1; j < k.length; j++) {
        const a = k[i], b = k[j];
        if (a.b !== b.b) continue;
        const aEigen = a.eigen.filter(x => !b.eigen.includes(x));
        const bEigen = b.eigen.filter(x => !a.eigen.includes(x));
        if (aEigen.length && bEigen.length) botst.add([sleutelId(a), sleutelId(b)].sort().join('|'));
      }
  }

  const vouw = new Map();
  for (const [, ids] of perBron) {
    const lijst = [...ids];
    for (let i = 0; i < lijst.length; i++)
      for (let j = i + 1; j < lijst.length; j++) {
        const [a, b] = [lijst[i], lijst[j]];
        if (botst.has([a, b].sort().join('|'))) continue;
        const na = meta.get(a).s, nb = meta.get(b).s;
        const stam = gedeeldeStam(na, nb);
        if (!stam) continue;
        vouw.set(a, stam); vouw.set(b, stam);
      }
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
  const vorm = (n) => `${(n.kinderen ?? []).length}(${(n.kinderen ?? []).map(vorm).join('')})`;
  const groepen = new Map();
  for (const b of bomen) {
    const v = vorm(b);
    if (!groepen.has(v)) groepen.set(v, []);
    groepen.get(v).push(b);
  }
  let verschoven = 0;
  for (const [, g] of groepen) {
    if (g.length < 2) continue;
    const rijen = g.map(b => plat(b));
    for (let i = 0; i < rijen[0].length; i++) {
      const tel = new Map();
      for (const r of rijen) tel.set(r[i].naam, (tel.get(r[i].naam) ?? 0) + 1);
      if (tel.size < 2) continue;
      const winnaar = [...tel.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
      for (const r of rijen) if (r[i].naam !== winnaar) { r[i].naam = winnaar; r[i].naamGestabiliseerd = true; verschoven++; }
    }
  }
  return verschoven;
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
  if (n.tekst) return [n.styleRef ? n.styleRef.split('/').pop() : 'label', 'rol'];
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
  const alle = bomen.flatMap(b => plat(b));
  const vouw = vouwAlternatieven(alle);

  // Universeel = de sleutel komt in ELKE variant ergens boven de drempel voor. Een
  // universele sleutel is de identiteit van het element, een conditionele de modifier —
  // en de modifier is precies wat de variant-as al uitdrukt.
  const perVariant = bomen.map(b => new Set(
    plat(b).flatMap(n => (n.kandidaten ?? [])
      .filter(c => c.eigen.length / c.n >= DREMPEL)
      .map(c => vouw.get(sleutelId(c)) ?? sleutelId(c)))));
  const universeel = new Set([...(perVariant[0] ?? [])].filter(s => perVariant.every(p => p.has(s))));

  for (const boom of bomen) loop(boom, null, true);
  stabiliseer(bomen);

  function loop(n, ouder, isWortel) {
    const k = (n.kandidaten ?? [])
      .map(c => {
        const id = sleutelId(c);
        const naam = vouw.get(id) ?? c.s;
        return { ...c, id, naam, cov: c.eigen.length / c.n, d: c.eigen.length,
                 u: universeel.has(vouw.get(id) ?? id) ? 0 : 1 };
      })
      .filter(c => c.cov >= DREMPEL)
      .sort((a, b) => a.u - b.u || b.cov - a.cov || b.d - a.d || a.v - b.v);
    const w = k[0];
    n.naamAmbigu = !!(w && k[1] && k[1].u === w.u && k[1].cov === w.cov && k[1].d === w.d && k[1].naam !== w.naam);

    if (isWortel) { n.naam = comp; n.naamBron = 'component'; }
    else if (w && w.b !== ouder?.naamBronId && componentVan(w.bron) && componentVan(w.bron) !== comp) {
      n.naam = componentVan(w.bron); n.naamBron = 'component';
    } else if (w) {
      n.naam = w.naam; n.naamBron = vouw.has(w.id) ? 'gefold' : 'sleutel';
    } else {
      const [naam, bron] = terugval(n, ouder);
      n.naam = naam; n.naamBron = bron;
    }
    n.naamBronId = w?.b ?? ouder?.naamBronId ?? null;
    for (const kind of n.kinderen ?? []) loop(kind, n, false);
  }
}

/** Meet de dekking en de variant-stabiliteit over een verzameling benoemde bomen. */
export function meet(perComponent) {
  const perBron = { sleutel: 0, gefold: 0, component: 0, rol: 0, terugval: 0 };
  let nodes = 0, doorvoer = 0, ambigu = 0, indexNamen = 0, copyNamen = 0, gestabiliseerd = 0;
  const hist = new Array(11).fill(0);
  const instabiel = [];

  for (const [comp, bomen] of Object.entries(perComponent)) {
    for (const b of bomen) for (const n of plat(b)) {
      nodes++;
      if (n.doorvoer) doorvoer++;
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

  const echt = perBron.sleutel + perBron.gefold + perBron.component;
  return { nodes, doorvoer, nodesZonderDoorvoer: nodes - doorvoer, perBron,
           echteNaamPct: +(100 * echt / (nodes - doorvoer)).toFixed(1),
           ambigu, gestabiliseerd, indexNamen, copyNamen, instabiel, dekkingHistogram: hist, drempel: DREMPEL };
}
