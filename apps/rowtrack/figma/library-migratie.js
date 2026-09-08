// ---------------------------------------------------------------------------
// Migratie: `RowTrack - Design` (T1bGrvIzSNeLyh5CbarATZ) van LOKALE variabelen en styles
// naar de gepubliceerde library `RowTrack -  Design System` (QkRgMc7Quqtbow71DiYa1n).
//
// Draait via figma_execute, in `RowTrack - Design`, met de signatuur (figma, opruimen).
// HERVATBAAR: elke aanroep werkt door tot
// zijn tijdbudget op is en onthoudt de voortgang in pluginData op de root. Roep hem net zo
// vaak aan tot `klaar: true`.
//
// Wat hij WEL doet: elke binding aan een lokale variabele omzetten naar de gelijknamige
// library-variabele, en elke lokale text/effect style vervangen door de library-style.
// Wat hij NIET doet: iets verwijderen. Het opruimen van de lege lokale collecties staat in
// een aparte stap (`OPRUIMEN = true`) die pas mag draaien als de telling 0 lokale bindingen
// geeft — een lokale collectie verwijderen terwijl er nog één binding aan hangt, maakt van
// die waarde stil een losse literal.
//
// Gemeten 2026-09-08 vóór de migratie: 3 845 nodes, 14 399 bindingen aan 84 lokale
// variabelen, 0 aan remote. Alle 84 paden hebben een tegenhanger in de library.
// Zie apps/rowtrack/figma/tokenlaag-inventaris.md.
// ---------------------------------------------------------------------------
// De verwijderende stap staat NIET in dit bestand aan/uit, maar in de aanroep: een
// destructieve vlag die in de broncode leeft, staat op een dag per ongeluk op true.
//   new F('figma', 'opruimen', bron)(figma, true)
const OPRUIMEN = typeof opruimen !== 'undefined' && opruimen === true;
const BUDGET_MS = 20000;         // ruim onder de 30 s wachtlimiet van figma_execute

if (figma.fileKey !== 'T1bGrvIzSNeLyh5CbarATZ')
  return { fout: 'verkeerde file: ' + figma.fileKey };
await figma.loadAllPagesAsync();

// ---- 1. De library-sleutels ------------------------------------------------------------
//
// PRIMAIRE BRON: figma/library-keys.json, gegenereerd uit het library-bestand zelf (recept in
// apps/rowtrack/CLAUDE.md) en geserveerd door `pnpm --filter rowtrack figma:serve`.
//
// Waarom niet `teamLibrary.getVariablesInLibraryCollectionAsync()`, wat de voor de hand
// liggende live-bron is: die listing is VEROUDERD en zegt dat niet. Gemeten 2026-09-08, ná
// een publicatie van vier hertypeerde variabelen: de listing gaf nog altijd
// `Core/fontWeight/regular [STRING]` met de oude sleutel, terwijl
// `importVariableByKeyAsync(<nieuwe sleutel>)` gewoon de FLOAT-variabele opleverde, remote en
// met waarde 400. Een gevulde, geloofwaardige, verkeerde uitkomst — het gevaarlijkste soort.
//
// De listing blijft er als TEGENPROEF: elk pad waar de twee het oneens zijn komt in
// `sleutelVerschil`, zodat een verouderd sleutelbestand zichzelf meldt in plaats van stil te
// blijven.
const libCols = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
const doelBib = libCols.filter(c => /Design System/.test(c.libraryName));
if (!doelBib.length)
  return { fout: 'geen library-collecties gevonden — is RowTrack -  Design System als library ingeschakeld in dit bestand?',
           gezien: libCols.map(c => c.libraryName + ' / ' + c.name) };

let bestand = null;
try { bestand = await (await fetch('http://localhost:9229/library-keys.json')).json(); }
catch (e) { return { fout: 'figma/library-keys.json niet op te halen — draait `pnpm --filter rowtrack figma:serve`? (' + e.message + ')' }; }
if (!bestand || bestand.fileKey !== 'QkRgMc7Quqtbow71DiYa1n')
  return { fout: 'library-keys.json hoort bij een ander bestand: ' + (bestand && bestand.fileKey) };

const libSleutel = new Map();    // "Collectie/pad" -> key
for (const [pad, v] of Object.entries(bestand.variabelen)) libSleutel.set(pad, v.key);

const sleutelVerschil = [];
for (const c of doelBib)
  for (const v of await figma.teamLibrary.getVariablesInLibraryCollectionAsync(c.key)) {
    const pad = c.name + '/' + v.name;
    const uitBestand = libSleutel.get(pad);
    if (uitBestand && uitBestand !== v.key) sleutelVerschil.push(`${pad}: bestand ${uitBestand.slice(0, 8)} tegen listing ${v.key.slice(0, 8)}`);
    if (!uitBestand) sleutelVerschil.push(`${pad}: alleen in de listing — library-keys.json is ouder dan de library`);
  }

// ---- 2. Lokale variabelen: pad PER BINDING oplossen, niet uit de collecties -------------
//
// Een kaart uit `getLocalVariableCollectionsAsync()` mist de WEZEN. Gemeten 2026-09-08 in dit
// bestand: de collectie Theme telde nog 1 variabele terwijl 4 397 bindingen naar 30 andere
// Theme-variabelen wezen. Die zijn uit de collectie verwijderd maar leven door zolang er een
// binding aan hangt: ze lossen op, `remote` is false, en ze staan in geen enkele lijst. Een
// migratie die op de collectielijst leunt, laat precies die 4 397 bindingen staan — en dat
// zijn de kleuren, niet de marges.
//
// Daarom: elk binding-id wordt zelf opgelost. `remote === true` betekent klaar; anders is het
// pad de collectienaam plus de variabelenaam, ook voor een wees.
const padCache = new Map();      // variabele-id -> "Collectie/pad" | null (al remote/onvindbaar)
async function padVan(id) {
  if (padCache.has(id)) return padCache.get(id);
  let pad = null;
  try {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (v && !v.remote) {
      const c = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
      if (c) pad = c.name + '/' + v.name;
    }
  } catch (e) { /* onvindbaar telt als klaar */ }
  padCache.set(id, pad);
  return pad;
}
const lokaalPad = { has: (id) => padCache.get(id) != null, get: (id) => padCache.get(id) };
const ontbreekt = [];

const geimporteerd = new Map();  // pad -> remote Variable
async function remoteVar(pad) {
  if (geimporteerd.has(pad)) return geimporteerd.get(pad);
  const v = await figma.variables.importVariableByKeyAsync(libSleutel.get(pad));
  geimporteerd.set(pad, v);
  return v;
}

// ---- 3. Voortgang ----------------------------------------------------------------------
const VLAG = 'libmigratie-gedaan';
const gedaan = new Set(JSON.parse(figma.root.getPluginData(VLAG) || '[]'));
const start = Date.now();
let herbonden = 0, stylesGezet = 0, overgeslagen = 0, bezocht = 0;
const meldingen = [];

/**
 * Tekstvelden hangen PER RANGE, niet per node. `boundVariables.fontSize` is op een TEXT-node
 * een array met één alias per stijlbereik, en `setBoundVariable` raakt daar alleen het eerste
 * van. Gemeten 2026-09-08: na de eerste ronde stond op node `I297:2358;…;290:2329`
 * `[fontSize/16 remote, fontSize/16 lokaal]` — half om, en de telling zag terecht nog een
 * lokale binding. `setRangeBoundVariable(0, lengte, veld, v)` klapt de array samen tot één
 * remote binding; nagemeten op diezelfde node.
 */
const TEKSTVELDEN = new Set(['fontSize', 'fontFamily', 'fontStyle', 'fontWeight',
                             'letterSpacing', 'lineHeight', 'paragraphSpacing', 'paragraphIndent']);

/** Zet één binding om. `veld` is de sleutel uit node.boundVariables. */
async function zetScalar(n, veld, alias) {
  const pad = await padVan(alias.id);
  if (!pad) return;                       // al remote of onvindbaar
  if (!libSleutel.has(pad)) { overgeslagen++; if (!ontbreekt.includes(pad)) ontbreekt.push(pad); return; }
  try {
    const rv = await remoteVar(pad);
    if (n.type === 'TEXT' && TEKSTVELDEN.has(veld)) n.setRangeBoundVariable(0, n.characters.length, veld, rv);
    else n.setBoundVariable(veld, rv);
    herbonden++;
  } catch (e) { meldingen.push(`${n.id} ${veld} (${pad}): ${e.message}`); }
}

/**
 * Effecten dragen hun kleurbinding op het effect zelf, net als een paint — en net als een
 * paint is een effect immutable. `setBoundVariable('effects', …)` bestaat niet; het veld
 * staat niet eens in de enum. Kopiëren, de alias erop zetten, de array terugleggen.
 */
async function zetEffecten(n) {
  try { await zetEffectenIntern(n); }
  catch (e) { meldingen.push(`${n.id} effects: ${e.message}`); }
}
async function zetEffectenIntern(n) {
  const oud = n.effects;
  if (!Array.isArray(oud) || !oud.length) return;
  let veranderd = false;
  const nieuw = [];
  for (const e of oud) {
    const a = e.boundVariables && e.boundVariables.color;
    const pad = a ? await padVan(a.id) : null;
    if (pad && libSleutel.has(pad)) {
      const rv = await remoteVar(pad);
      nieuw.push({ ...JSON.parse(JSON.stringify(e)),
                   boundVariables: { ...e.boundVariables, color: { type: 'VARIABLE_ALIAS', id: rv.id } } });
      veranderd = true; herbonden++;
    } else {
      if (pad) { overgeslagen++; if (!ontbreekt.includes(pad)) ontbreekt.push(pad); }
      nieuw.push(e);
    }
  }
  if (veranderd) { try { n.effects = nieuw; } catch (err) { meldingen.push(`${n.id} effects: ${err.message}`); } }
}

/** Verf (fills/strokes) opnieuw binden. Een paint is immutable: kopiëren en terugzetten. */
async function zetVerf(n, soort) {
  try { await zetVerfIntern(n, soort); }
  catch (e) { meldingen.push(`${n.id} ${soort}: ${e.message}`); }
}
async function zetVerfIntern(n, soort) {
  const oud = n[soort];
  if (!Array.isArray(oud) || !oud.length) return;
  let veranderd = false;
  const nieuw = [];
  for (const p of oud) {
    let q = JSON.parse(JSON.stringify(p));
    const alias = p.boundVariables && p.boundVariables.color;
    const padP = alias ? await padVan(alias.id) : null;
    if (padP && libSleutel.has(padP)) {
      q = figma.variables.setBoundVariableForPaint(q, 'color', await remoteVar(padP));
      veranderd = true; herbonden++;
    } else if (padP) { overgeslagen++; if (!ontbreekt.includes(padP)) ontbreekt.push(padP); }
    if (Array.isArray(q.gradientStops)) {
      const stops = [];
      for (const st of q.gradientStops) {
        const a = st.boundVariables && st.boundVariables.color;
        const padS = a ? await padVan(a.id) : null;
        if (padS && libSleutel.has(padS)) {
          const rv = await remoteVar(padS);
          // setBoundVariableForPaint werkt niet op een gradientstop (gemeten 2026-09-07);
          // de alias moet met de hand op de stop staan.
          stops.push({ ...st, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: rv.id } } });
          veranderd = true; herbonden++;
        } else stops.push(st);
      }
      q = { ...q, gradientStops: stops };
    }
    nieuw.push(q);
  }
  if (veranderd) n[soort] = nieuw;
}

/**
 * Eén node migreren. ELKE schrijfactie zit in een try/catch.
 *
 * `zetVerf` en `zetEffecten` deden dat niet, en dat is erger dan een gemiste binding: een
 * rejection uit `importVariableByKeyAsync` ontsnapte uit `migreer`, uit de chunk-lus én langs
 * `figma.root.setPluginData(VLAG, …)` heen. Alle top-level nodes die deze run al gemigreerd
 * had verdwenen daarmee uit `gedaan`, de volgende aanroep begon opnieuw bij dezelfde pagina en
 * struikelde over dezelfde paint — de migratie kon die node nooit passeren. Hoe langer de run,
 * hoe meer werk er bij één rejection sneuvelde.
 */
async function migreer(n) {
  bezocht++;
  const bv = n.boundVariables;
  if (bv) for (const [veld, w] of Object.entries(bv)) {
    if (veld === 'fills' || veld === 'strokes' || veld === 'effects') continue;   // eigen tak
    if (Array.isArray(w)) { for (const a of w) if (a && a.id) await zetScalar(n, veld, a); }
    else if (w && w.id) await zetScalar(n, veld, w);
  }
  await zetVerf(n, 'fills');
  await zetVerf(n, 'strokes');
  await zetEffecten(n);

  // Text- en effect-styles: een lokale style-id wordt de library-style met dezelfde naam.
  for (const prop of ['textStyleId', 'effectStyleId']) {
    const id = n[prop];
    if (!id || typeof id !== 'string' || id === figma.mixed) continue;
    const s = await figma.getStyleByIdAsync(id);
    if (!s || s.remote) continue;                       // al remote of onvindbaar
    const key = STYLE_KEYS[s.name];
    if (!key) { meldingen.push(`style zonder library-tegenhanger: ${s.name}`); continue; }
    try {
      const r = await figma.importStyleByKeyAsync(key);
      if (prop === 'textStyleId' && typeof n.setTextStyleIdAsync === 'function') await n.setTextStyleIdAsync(r.id);
      else if (prop === 'effectStyleId' && typeof n.setEffectStyleIdAsync === 'function') await n.setEffectStyleIdAsync(r.id);
      else n[prop] = r.id;
      stylesGezet++;
    } catch (e) { meldingen.push(`style ${s.name}: ${e.message}`); }
  }
}

// De styles hebben géén teamLibrary-API; ze komen uit hetzelfde gegenereerde bestand.
const STYLE_KEYS = Object.fromEntries([
  ...Object.entries(bestand.textStyles).map(([n, v]) => [n, v.key]),
  ...Object.entries(bestand.effectStyles).map(([n, v]) => [n, v.key]),
]);

// ---- 4. Werk in stukken -----------------------------------------------------------------
let klaar = true;
for (const p of figma.root.children) {
  for (const top of p.children) {
    if (gedaan.has(top.id)) continue;
    if (Date.now() - start > BUDGET_MS) { klaar = false; break; }
    const stapel = [top];
    while (stapel.length) {
      const n = stapel.pop();
      await migreer(n);
      if ('children' in n) stapel.push(...n.children);
    }
    gedaan.add(top.id);
  }
  if (!klaar) break;
}
figma.root.setPluginData(VLAG, JSON.stringify([...gedaan]));

// ---- 5. Tellen: hoeveel bindingen hangen er nog aan een lokale variabele? ---------------
let restLokaal = 0, remote = 0;
if (klaar) {
  const tel = async (id) => { (await padVan(id)) ? restLokaal++ : remote++; };
  const loop = async (n) => {
    if (n.boundVariables) for (const w of Object.values(n.boundVariables)) {
      if (Array.isArray(w)) { for (const a of w) if (a && a.id) await tel(a.id); }
      else if (w && w.id) await tel(w.id);
    }
    for (const soort of ['fills', 'strokes', 'effects']) {
      if (!Array.isArray(n[soort])) continue;
      for (const v of n[soort]) {
        if (v.boundVariables) for (const a of Object.values(v.boundVariables)) if (a && a.id) await tel(a.id);
        if (Array.isArray(v.gradientStops)) for (const st of v.gradientStops)
          if (st.boundVariables && st.boundVariables.color) await tel(st.boundVariables.color.id);
      }
    }
    if ('children' in n) for (const k of n.children) await loop(k);
  };
  for (const p of figma.root.children) for (const k of p.children) await loop(k);
}

// ---- 6. Opruimen — alleen expliciet, en alleen op een schone telling --------------------
let opgeruimd = null;
if (OPRUIMEN) {
  if (!klaar || restLokaal > 0)
    return { fout: `weiger op te ruimen: klaar=${klaar}, nog ${restLokaal} lokale binding(en)` };
  const weg = [];
  for (const c of await figma.variables.getLocalVariableCollectionsAsync()) { weg.push(c.name); c.remove(); }
  for (const s of await figma.getLocalTextStylesAsync()) { weg.push('tekststijl ' + s.name); s.remove(); }
  for (const s of await figma.getLocalEffectStylesAsync()) { weg.push('effectstijl ' + s.name); s.remove(); }
  figma.root.setPluginData(VLAG, '');
  opgeruimd = weg;
}

return {
  fileKey: figma.fileKey, klaar, ontbrekendePaden: ontbreekt, sleutelVerschil,
  bezocht, herbonden, stylesGezet, overgeslagen,
  restLokaal: klaar ? restLokaal : null, remote: klaar ? remote : null,
  opgeruimd, meldingen: meldingen.slice(0, 10), aantalMeldingen: meldingen.length,
  voortgang: `${gedaan.size} top-level nodes gedaan`,
};
