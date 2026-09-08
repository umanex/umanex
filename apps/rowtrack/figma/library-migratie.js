// ---------------------------------------------------------------------------
// Migratie: `RowTrack - Design` (T1bGrvIzSNeLyh5CbarATZ) van LOKALE variabelen en styles
// naar de gepubliceerde library `RowTrack -  Design System` (QkRgMc7Quqtbow71DiYa1n).
//
// Draait via figma_execute, in `RowTrack - Design`. HERVATBAAR: elke aanroep werkt door tot
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
const OPRUIMEN = false;          // zet op true voor de laatste, verwijderende stap
const BUDGET_MS = 20000;         // ruim onder de 30 s wachtlimiet van figma_execute

if (figma.fileKey !== 'T1bGrvIzSNeLyh5CbarATZ')
  return { fout: 'verkeerde file: ' + figma.fileKey };
await figma.loadAllPagesAsync();

// ---- 1. De library-sleutels, LIVE gelezen ---------------------------------------------
// Geen ingebakken sleutellijst: die veroudert stil zodra er een variabele bijkomt, en een
// verouderde sleutel geeft een onvindbare variabele in plaats van een foutmelding.
const libCols = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
const doelBib = libCols.filter(c => /Design System/.test(c.libraryName));
if (!doelBib.length)
  return { fout: 'geen library-collecties gevonden — is RowTrack -  Design System als library ingeschakeld in dit bestand?',
           gezien: libCols.map(c => c.libraryName + ' / ' + c.name) };

const libSleutel = new Map();    // "Collectie/pad" -> key
for (const c of doelBib)
  for (const v of await figma.teamLibrary.getVariablesInLibraryCollectionAsync(c.key))
    libSleutel.set(c.name + '/' + v.name, v.key);

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

// De styles hebben géén teamLibrary-API, dus hun sleutels staan hier wél ingebakken —
// gelezen uit het library-bestand op 2026-09-08. Verandert een stylenaam, dan meldt de
// migratie "style zonder library-tegenhanger" in plaats van stil door te lopen.
const STYLE_KEYS = {
  "type/heroNumeric": "c32b6010501dfac140163038ca49ed568dec3cd6",
  "type/heroDisplay": "749b5022d88f7181014550c8afd43e8a47759eff",
  "type/activeProgress": "332d6d5667ebbc4ff595b66fc47aabf382b0ebea",
  "type/sectionValue": "e64df0a77367663b61ba9fac8ce2521a63aec1e1",
  "type/kpiValue": "ff600e591d877a8a54357743b09c58cd0a9bcc54",
  "type/kpiUnit": "7044b709eb700fc29345096e065cdef30e5d880e",
  "type/italicConnector": "8384cf6773930a2e73a5ffb6f67754bb4ed8dd3f",
  "type/buttonPrimary": "fd57eb54d2227967ebed1d4de323f2a7bb35f589",
  "type/buttonOutline": "5937a20fdfc913b9353a0c04249b7796cc7aa93a",
  "type/textLink": "3c6667dce8c24a059351b1da7b8a53ac5abde5e5",
  "type/segmentInactive": "02952a4953f34066011fd102ab79a8ef88209d23",
  "type/segmentActive": "024496b86d0984d8c1c43c8cd303f615ceee2284",
  "type/splitsRow": "08db199f2132dad242dfd655010c515a239118e9",
  "type/recentRow": "beb6a2f9bece303830f4cd583933acafc4df92a0",
  "type/labelSection": "a337db532eee24ef9e26dd7509dd0df0c937ae03",
  "type/labelKpi": "6075647dc3dbb2ef446c14edd72709314a94fa78",
  "type/labelMicro": "6059fd3ea7e6df67eecacd17740f1d75637cffa8",
  "type/labelGoalPrefix": "44fc188234e272bba322aab8eb69892757f26d73",
  "shadow/buttonPrimary": "b9cd8e97fe9eeba0e4be31b4cf8e1c8b4bec3d43",
  "shadow/buttonOutline": "a3be0d96b8aa667df76ba351b307503f04916128"
};

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
  fileKey: figma.fileKey, klaar, ontbrekendePaden: ontbreekt,
  bezocht, herbonden, stylesGezet, overgeslagen,
  restLokaal: klaar ? restLokaal : null, remote: klaar ? remote : null,
  opgeruimd, meldingen: meldingen.slice(0, 10), aantalMeldingen: meldingen.length,
  voortgang: `${gedaan.size} top-level nodes gedaan`,
};
