#!/usr/bin/env node
/**
 * Toetst of de RowTrack-code en het Figma-bestand "RowTrack — Design System" één op één
 * staan. Draait via `pnpm --filter rowtrack figma:check`.
 *
 * WAT DIT WEL VANGT: een component zonder story of zonder Figma-pagina · een variant-as die
 * bijkomt of wegvalt · een variant-nodelijst die half is · een Figma-variabele die niet uit
 * tokens.json volgt · een tokenwaarde die in Figma anders staat · een text style waarvan de
 * getallen niet uit de tokenschaal komen · een deep-link naar een node die niet bestaat of
 * bij een ander component hoort · een hardcoded kleur of maat in een story · een groeiend
 * aantal ongebonden waarden.
 *
 * WAT DIT NIET VANGT, en dat is breder dan het lijkt:
 *  (a) Een wijziging die iemand in Figma maakt zonder de manifest te verversen. De manifest
 *      is een NEERGESLAGEN METING, geen live verbinding — CI heeft geen Figma-toegang.
 *  (b) Of een component er in Figma hetzelfde UITZIET als in de browser. Daarvoor is
 *      `pnpm --filter rowtrack parity`; die vergelijkt maten per variant-node.
 *  (c) Alles wat de bouwspec afkapte: kinderen voorbij diepte 4 of voorbij 8 broers.
 *
 * Daarom noemt de slotregel de assen en het bereik, en niet "in sync": die zin claimt meer
 * dan de assen dragen (umanex-apps HANDOFF 2026-08-25).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootFlag = process.argv.find(a => a.startsWith('--root='));
const APP = rootFlag ? rootFlag.slice('--root='.length) : join(dirname(fileURLToPath(import.meta.url)), '..');

const fails = [], checks = [], overgeslagen = [], uitgesloten = [];
const fail = (as, m) => fails.push(`[${as}] ${m}`);
const ok = (as, m) => checks.push(`[${as}] ${m}`);
const sla = (as, m) => overgeslagen.push(`[${as}] ${m}`);

const lees = (p, verplicht = true) => {
  const pad = join(APP, p);
  if (!existsSync(pad)) { if (verplicht) sla('bestand', `${p} ontbreekt`); return null; }
  return JSON.parse(readFileSync(pad, 'utf8'));
};

const manifest = lees('figma/manifest.json');
const assenSpec = lees('figma/story-axes.json');
const payload   = lees('figma/tokens-payload.json');
const gaten     = lees('figma/ongebonden.json');
const laagnamen = lees('figma/laagnamen.json', false);
const tokens    = lees('tokens/tokens.json');

/**
 * Componenten die met reden GEEN component set zijn. Elke uitsluiting is een oordeel dat
 * deze guard daarna als waarheid vastlegt, dus hij staat hier met zijn reden en niet in
 * een configbestand — bij het lezen van de guard komt hij vanzelf langs.
 */
const SCHERMEN = {
  ActivePhase: 'schermcompositie — bleStatus × hrStatus × phase × hasProfileWeight zou 160 nodes eisen voor één scherm, en die assen zijn in beeld niet orthogonaal',
  IdlePhase: 'schermcompositie — idem, 320 nodes',
};
const GEEN_COMPONENT = {
  PaceZone: 'exporteert getPaceZone, een pure functie zonder JSX — geen component, dus geen story en geen pagina',
};
const NIET_VISUEEL = {
  'BottomSheet.visible': 'mount-schakelaar — bij false rendert het component niets',
  'GoalSheet.visible': 'mount-schakelaar — bij false rendert het component niets',
  'HealthConsentScreen.visible': 'mount-schakelaar — bij false rendert het component niets',
  'DeviceSelectionModal.visible': 'mount-schakelaar — bij false rendert het component niets',
};
/**
 * Waarden die de CODE gebruikt en waarvoor geen token bestaat. Ze staan hier als GETAL,
 * niet als lijst-van-uitzonderingen: de as toetst dat het aantal niet GROEIT. Zo blijft een
 * nieuw gat zichtbaar terwijl de bekende gaten de as niet elke run rood maken.
 * Elk gat heeft een item in apps/rowtrack/BACKLOG.md.
 */
const BEKENDE_GATEN = 46;
/** Voorkomens, niet alleen unieke waarden. De deduplicatie is app-breed, dus een nieuw gat dat
 *  een bekende waarde hergebruikt is in `aantalUniek` onzichtbaar. */
const BEKENDE_VOORKOMENS = 1929;   // 1906 + 23 uit de modal-overlays, die sinds 2026-09-08 gemeten worden
/** Aandeel laagnamen dat uit de code komt (sleutel + gefold + componentnaam), in procent.
 *  Een ratel zoals BEKENDE_GATEN: dalen is een regressie, stijgen vraagt om bijstellen. */
const LAAGNAAM_DEKKING = 75.4;
/** Posities die `stabiliseer()` moest gladstrijken. `instabiel` is ná die pas gemeten en dus
 *  per constructie leeg — dit is de enige onafhankelijke maat voor dezelfde eigenschap. */
const BEKENDE_INSTABIELE_POSITIES = 2;

/** De dertien assen, in volgorde. Enige bron voor de slotregel — een hardgecodeerde
 *  opsomming raakt los van wat er werkelijk gedraaid heeft. */
const ASSEN = ['dekking', 'pagina', 'variant', 'varianten', 'token', 'tokenwaarde', 'typografie',
               'link', 'hardcoded', 'binding', 'publicatie', 'laagnaam', 'instancevulling'];
// Verdeling op 2026-09-08: 18 typografie-combinaties zonder Theme/type-token · 8 icoonmaten
// (Ionicons als glyph, geen Figma-font) · 5 achtergrondkleuren · 3 paddings (3, 50, 100) ·
// 3 radii (2, 12, 24) · 3 emoji/systeemfont (bedoeld — een emoji hoort de systeem-emojifont
// te gebruiken) · 2 gaps (1, 3) · 2 gradient-stops op alpha 0 (er is geen token voor "deze
// rol, maar doorzichtig") · 2 tekstkleuren.
//
// Het waren er 38 tot de doorvoer-fix van 2026-09-08. Dat aantal STEEG omdat er meer inhoud
// gemeten werd, niet omdat er iets kapotging: vijf overlay-componenten stonden daarvóór met
// nul tekstnodes in de spec, dus hun typografie werd nooit geteld.

// ---- 1. Dekking: elk component een story ----------------------------------
function bestanden(map, prefix = '') {
  const uit = [];
  for (const d of readdirSync(map, { withFileTypes: true })) {
    if (d.isDirectory()) { uit.push(...bestanden(join(map, d.name), prefix + d.name + '/')); continue; }
    if (d.name.endsWith('.tsx')) uit.push({ rel: prefix + d.name, pad: join(map, d.name) });
  }
  return uit;
}
const alle = bestanden(join(APP, 'components'));
const componentBestanden = alle.filter(f => !f.rel.endsWith('.stories.tsx'));
const storyBestanden = alle.filter(f => f.rel.endsWith('.stories.tsx'));
const zonderStory = componentBestanden
  .filter(f => !storyBestanden.some(s => s.rel === f.rel.replace(/\.tsx$/, '.stories.tsx')))
  .map(f => f.rel.replace(/\.tsx$/, ''));
const onverwacht = zonderStory.filter(n => !GEEN_COMPONENT[n.split('/').pop()]);
if (onverwacht.length) fail('dekking', `zonder story: ${onverwacht.join(', ')}`);
else ok('dekking', `${storyBestanden.length} van ${componentBestanden.length} bestanden hebben een story`);
for (const [n, r] of Object.entries(GEEN_COMPONENT)) uitgesloten.push(`${n} — ${r}`);

// ---- 2. Pagina: elk component één primary node ------------------------------
if (!manifest) sla('pagina', 'geen manifest');
else {
  const paginas = Object.keys(manifest.pages);
  const verwacht = storyBestanden.map(s => {
    const src = readFileSync(s.pad, 'utf8');
    return src.match(/title:\s*'Componenten\/([^']+)'/)?.[1] ?? null;
  }).filter(Boolean);
  const mist = verwacht.filter(c => !paginas.includes(c));
  const teveel = paginas.filter(p => !verwacht.includes(p) && p !== 'Tokens');
  const zonderPrimary = paginas.filter(p => manifest.pages[p] && !manifest.pages[p].primary);
  if (mist.length) fail('pagina', `geen Figma-pagina voor: ${mist.join(', ')}`);
  if (teveel.length) fail('pagina', `Figma-pagina zonder component: ${teveel.join(', ')}`);
  if (zonderPrimary.length) fail('pagina', `pagina zonder primary node: ${zonderPrimary.join(', ')}`);
  if (!mist.length && !teveel.length && !zonderPrimary.length)
    ok('pagina', `${verwacht.length} componenten hebben elk één Figma-pagina met een primary node`);
}

// ---- 3. Variant-assen: Figma == story-argTypes ------------------------------
if (!manifest || !assenSpec) sla('variant', 'manifest of story-axes ontbreekt');
else {
  const fouten = [];
  for (const [comp, d] of Object.entries(assenSpec.componenten)) {
    if (SCHERMEN[comp]) continue;
    const codeAssen = {};
    for (const [as, w] of Object.entries(d.assen)) {
      if (NIET_VISUEEL[`${comp}.${as}`]) continue;
      codeAssen[as] = [...w].map(String).sort();
    }
    const p = manifest.pages[comp];
    if (!p?.primary) { fouten.push(`${comp}: geen primary in de manifest`); continue; }
    const figmaAssen = p.primary.variantProperties ?? null;
    const codeNamen = Object.keys(codeAssen).sort();
    const figmaNamen = figmaAssen ? Object.keys(figmaAssen).sort() : [];
    if (codeNamen.join(',') !== figmaNamen.join(',')) {
      fouten.push(`${comp}: assen verschillen — code [${codeNamen}] vs Figma [${figmaNamen}]`);
      continue;
    }
    for (const as of codeNamen) {
      const c = codeAssen[as].join(',');
      const f = [...(figmaAssen[as].values ?? figmaAssen[as])].map(String).sort().join(',');
      if (c !== f) fouten.push(`${comp}.${as}: code [${c}] vs Figma [${f}]`);
    }
  }
  if (fouten.length) for (const f of fouten) fail('variant', f);
  else ok('variant', `${Object.keys(assenSpec.componenten).length - Object.keys(SCHERMEN).length} componenten: variant-assen gelijk aan de story-argTypes`);
  for (const [k, r] of Object.entries(NIET_VISUEEL)) uitgesloten.push(`${k} — ${r}`);
  for (const [k, r] of Object.entries(SCHERMEN)) uitgesloten.push(`${k} — ${r}`);
}

// ---- 4. Variant-nodes: het aantal volgt uit de assen ------------------------
if (!manifest) sla('varianten', 'geen manifest');
else if ((manifest.schemaVersie ?? 1) < 2) sla('varianten', 'manifest schema 1 kent geen variant-nodes');
else {
  const fouten = [];
  let telNodes = 0;
  for (const [pagina, p] of Object.entries(manifest.pages)) {
    const n = p.primary;
    if (!n) continue;
    if (n.type !== 'COMPONENT_SET') {
      if (n.varianten?.length) fouten.push(`${pagina}/${n.name}: geen COMPONENT_SET maar wel ${n.varianten.length} varianten`);
      continue;
    }
    const assen = n.variantProperties;
    if (!assen || !Object.keys(assen).length) { fouten.push(`${pagina}: COMPONENT_SET zonder assen`); continue; }
    const verwacht = Object.values(assen).reduce((a, w) => a * (w.values ?? w).length, 1);
    const werkelijk = n.varianten?.length ?? 0;
    telNodes += werkelijk;
    if (werkelijk !== verwacht) {
      const t = Object.entries(assen).map(([a, w]) => `${a}=${(w.values ?? w).length}`).join(' × ');
      fouten.push(`${pagina}: ${werkelijk} variant-nodes, ${t} = ${verwacht} verwacht`);
    }
    const dubbel = (n.varianten ?? []).map(v => v.id).filter((id, i, a) => a.indexOf(id) !== i);
    if (dubbel.length) fouten.push(`${pagina}: dubbele node-id ${[...new Set(dubbel)].join(', ')}`);
  }
  if (fouten.length) for (const f of fouten) fail('varianten', f);
  else ok('varianten', `${telNodes} variant-nodes, elk aantal gelijk aan het product van zijn assen`);
}

// ---- 5. Token: elke Figma-variabele volgt uit tokens.json (beide richtingen) --
if (!manifest || !payload) sla('token', 'manifest of payload ontbreekt');
else {
  const verwacht = new Set();
  for (const [set, c] of Object.entries(payload.collecties))
    for (const v of c.variabelen) verwacht.add(`${set}/${v.naam}`);
  const inFigma = new Set();
  for (const [set, c] of Object.entries(manifest.collections ?? {}))
    for (const naam of c.variables ?? []) inFigma.add(`${set}/${naam}`);
  const tekort = [...verwacht].filter(x => !inFigma.has(x));
  const teveel = [...inFigma].filter(x => !verwacht.has(x));
  if (tekort.length) fail('token', `${tekort.length} tokens zonder Figma-variabele, o.a. ${tekort.slice(0, 4).join(', ')}`);
  if (teveel.length) fail('token', `${teveel.length} Figma-variabelen zonder token, o.a. ${teveel.slice(0, 4).join(', ')}`);
  if (!tekort.length && !teveel.length) ok('token', `${verwacht.size} variabelen: elke Figma-variabele heeft een pad in tokens.json en omgekeerd`);
}

// ---- 5b. Tokenwaarde: de waarde zelf, niet enkel de naam --------------------
const TOL = 0.6;  // 8-bit RGB-kwantisatie; een echte kleurwijziging schuift veel verder
if (!manifest?.collections || !payload) sla('tokenwaarde', 'manifest zonder waarden — ververs met het schema-3-recept');
else {
  const bron = new Map();
  for (const [set, c] of Object.entries(payload.collecties))
    for (const v of c.variabelen) bron.set(`${set}/${v.naam}`, v);
  const fouten = [];
  let geteld = 0;
  for (const [set, c] of Object.entries(manifest.collections)) {
    for (const [naam, w] of Object.entries(c.waarden ?? {})) {
      const b = bron.get(`${set}/${naam}`);
      if (!b) continue;
      // `geteld++` stond hier vóór de type-dispatch en telde dus ook de takken die met NIETS
      // vergelijken. Gemeten: beide fontFamily-waarden op "Comic Sans MS" gaven nog steeds
      // "250 variabelewaarden gelijk aan tokens.json". Nu telt hij alleen wat écht getoetst is.
      if (b.alias) {
        geteld++;
        if (w.alias !== `${b.alias.set}/${b.alias.naam}`)
          fouten.push(`${set}/${naam}: Figma wijst naar ${w.alias ?? '(geen alias)'}, bron zegt ${b.alias.set}/${b.alias.naam}`);
      } else if (b.type === 'COLOR') {
        geteld++;
        const k = w.waarde;
        if (!k || Math.abs(k.r * 255 - b.waarde.r * 255) > TOL || Math.abs(k.g * 255 - b.waarde.g * 255) > TOL
            || Math.abs(k.b * 255 - b.waarde.b * 255) > TOL || Math.abs((k.a ?? 1) - (b.waarde.a ?? 1)) > 0.01)
          fouten.push(`${set}/${naam}: Figma ${JSON.stringify(k)} tegen bron ${JSON.stringify(b.waarde)}`);
      } else if (b.type === 'FLOAT') {
        geteld++;
        if (w.waarde !== b.waarde) fouten.push(`${set}/${naam}: Figma ${w.waarde} tegen bron ${b.waarde}`);
      } else if (b.type === 'STRING' && b.expoBase) {
        // Een fontFamily-variabele hoort de GERENDERDE familie te dragen, niet de tokenwaarde
        // — `Source Serif Pro` in de bron rendert als `SourceSerif4`. Deze tak vergeleek eerst
        // met niets; nu toetst hij tegen expoBase, dezelfde bewering als de typografie-as.
        geteld++;
        const wil = b.expoBase.replace(/\s+/g, '');
        if (String(w.waarde).replace(/\s+/g, '') !== wil)
          fouten.push(`${set}/${naam}: Figma "${w.waarde}" tegen gerenderde familie "${b.expoBase}"`);
      } else if (b.type === 'STRING') {
        geteld++;
        if (w.waarde !== b.waarde) fouten.push(`${set}/${naam}: Figma "${w.waarde}" tegen bron "${b.waarde}"`);
      }
    }
  }
  if (!geteld) sla('tokenwaarde', 'manifest draagt geen variabelewaarden');
  else if (fouten.length) for (const f of fouten.slice(0, 10)) fail('tokenwaarde', f);
  else if (geteld < bron.size)
    fail('tokenwaarde', `${geteld} van ${bron.size} variabelen vergeleken — ${bron.size - geteld} staan wel in tokens.json maar dragen geen waarde in het manifest`);
  else ok('tokenwaarde', `${geteld} variabelewaarden vergeleken en gelijk aan tokens.json (kleurtolerantie ${TOL}/255)`);
}

// ---- 5c. Typografie: elke text style volgt Theme/type ------------------------
if (!manifest || !payload) sla('typografie', 'manifest of payload ontbreekt');
else if (!Array.isArray(manifest.textStyles)) sla('typografie', 'manifest draagt geen textStyles');
else {
  const bron = new Map(payload.textStyles.map(t => [t.naam, t]));
  const fouten = [];
  for (const st of manifest.textStyles) {
    const b = bron.get(st.name);
    if (!b) { fouten.push(`${st.name}: geen Theme/type-token met deze naam`); continue; }
    if (st.fontSize !== b.fontSize) fouten.push(`${st.name}: fontSize ${st.fontSize} tegen token ${b.fontSize}`);
    const lhVerwacht = b.lineHeight === null ? 'AUTO' : b.lineHeight;
    if (String(st.lineHeight) !== String(lhVerwacht)) fouten.push(`${st.name}: lineHeight ${st.lineHeight} tegen ${lhVerwacht}`);
    if (Math.abs((st.letterSpacing ?? 0) - (b.letterSpacingPct ?? 0)) > 0.01)
      fouten.push(`${st.name}: letterSpacing ${st.letterSpacing}% tegen token ${b.letterSpacingPct}%`);
    // De familie hoort de GERENDERDE familie te zijn, niet de tokenstring — zie
    // scripts/figma-tokens-payload.mjs, RENDER_FAMILIE.
    const verwachteFamilie = b.expoVariant.split('_')[0];
    if (String(st.family).replace(/\s+/g, '') !== verwachteFamilie)
      fouten.push(`${st.name}: family "${st.family}" tegen gerenderde ${verwachteFamilie}`);
  }
  const mist = payload.textStyles.filter(t => !manifest.textStyles.some(s => s.name === t.naam));
  if (mist.length) fouten.push(`${mist.length} type-tokens zonder text style: ${mist.map(t => t.naam).join(', ')}`);
  if (fouten.length) for (const f of fouten.slice(0, 10)) fail('typografie', f);
  else ok('typografie', `${manifest.textStyles.length} text styles volgen Theme/type (grootte, regelhoogte, spatiëring, gerenderde familie)`);
}

// ---- 6. Deep-links ----------------------------------------------------------
if (!manifest) sla('link', 'geen manifest');
else {
  const nodeIds = new Set();
  for (const p of Object.values(manifest.pages)) {
    if (p.primary) nodeIds.add(p.primary.id);
    for (const e of p.extra ?? []) nodeIds.add(e.id);
  }
  let geteld = 0;
  for (const s of storyBestanden) {
    const src = readFileSync(s.pad, 'utf8');
    const comp = src.match(/title:\s*'Componenten\/([^']+)'/)?.[1];
    if (!comp) { fail('link', `${s.rel}: geen title`); continue; }
    const m = src.match(/figma:\s*\{\s*url:\s*'([^']+)'/);
    if (!m) { fail('link', `${s.rel}: geen parameters.figma.url`); continue; }
    if (!m[1].includes(manifest.fileKey)) { fail('link', `${s.rel}: URL wijst niet naar fileKey ${manifest.fileKey}`); continue; }
    const id = m[1].match(/node-id=([\w-]+)/)?.[1]?.replace('-', ':');
    if (!id) { fail('link', `${s.rel}: geen node-id in de URL`); continue; }
    if (!nodeIds.has(id)) { fail('link', `${s.rel}: node-id ${id} bestaat niet in de manifest`); continue; }
    const verwacht = manifest.pages[comp]?.primary?.id;
    if (id !== verwacht) { fail('link', `${s.rel}: linkt naar ${id}, maar ${comp} staat op ${verwacht}`); continue; }
    geteld++;
  }
  if (!fails.some(f => f.startsWith('[link]')))
    // WAT DEZE AS MEET, en wat niet. `scripts/figma-links.mjs` SCHRIJFT de story-URL uit
    // `manifest.pages[c].primary.id`, en deze as toetst dat diezelfde URL daaraan gelijk is.
    // Producent en toets delen dus één veld uit één bron: de as bewijst dat `figma:links`
    // gedraaid is sinds de laatste manifest-edit, niet dat de node in Figma nog leeft.
    // Gemeten: 33 verzonnen ids in het manifest gaven 33 FAILs, en ná één keer `figma:links`
    // stond de as weer groen met 33 dode links. De liveness komt van de VERSHEID van het
    // manifest — dat is wat de [publicatie]-as meet — en van de volgorde in CLAUDE.md:
    // eerst het manifest verversen, dan pas figma:links en figma:check.
    ok('link', `${geteld} deep-links gelijk aan de primary-id in het manifest van ${manifest?.gegenereerd ?? '?'} `
      + '(dat de node in Figma leeft, meet deze as niet — zie [publicatie])');
}

// ---- 7. Hardcoded waarden in stories ----------------------------------------
{
  const fouten = [];
  for (const s of storyBestanden) {
    const src = readFileSync(s.pad, 'utf8')
      .split('\n').filter(r => !/^\s*(\/\/|\*|\/\*)/.test(r)).join('\n');   // commentaar telt niet mee
    // Vier notaties, niet één. `/#[0-9A-Fa-f]{6}\b/` liet 3-cijferige hex (#f0a), 8-cijferige
    // hex (de \b sluit hem juist uit, want D is een word-char) en rgb()/rgba()/hsl() door —
    // terwijl React Native ze alle vier accepteert. Gemeten: drie hardcoded kleuren in één
    // story gaven "33 stories zonder hardcoded hex", exit 0.
    const hex = src.match(/#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![0-9A-Fa-f])/g) ?? [];
    const functioneel = src.match(/\b(?:rgba?|hsla?)\s*\([^)]*\)/g) ?? [];
    const fontnaam = src.match(/fontFamily:\s*'[^']+'/g) ?? [];
    // Een deep-link-URL bevat geen kleur; een fontnaam wel nooit. Alleen echte waarden.
    if (hex.length) fouten.push(`${s.rel}: ${hex.length} hardcoded hex (${[...new Set(hex)].slice(0, 3).join(', ')})`);
    if (functioneel.length) fouten.push(`${s.rel}: ${functioneel.length} hardcoded kleurfunctie (${[...new Set(functioneel)].slice(0, 2).join(', ')})`);
    if (fontnaam.length) fouten.push(`${s.rel}: ${fontnaam.length} hardcoded fontFamily`);
  }
  if (fouten.length) for (const f of fouten) fail('hardcoded', f);
  else ok('hardcoded', `${storyBestanden.length} stories zonder hardcoded kleur (hex in 3/4/6/8 cijfers, rgb/rgba/hsl) of fontnaam`);
}

// ---- 8. Binding: het aantal ongebonden waarden mag niet groeien --------------
if (!gaten) sla('binding', 'geen figma/ongebonden.json — draai `pnpm --filter rowtrack figma:spec`');
else {
  const n = gaten.aantalUniek;
  if (n > BEKENDE_GATEN)
    fail('binding', `${n} unieke ongebonden waarden, ${BEKENDE_GATEN} bekend — ${n - BEKENDE_GATEN} nieuw(e). Zie BACKLOG.md.`);
  else if (n < BEKENDE_GATEN)
    fail('binding', `${n} unieke ongebonden waarden tegen ${BEKENDE_GATEN} bekend — een gat is opgelost; zet BEKENDE_GATEN op ${n}.`);
  else if (gaten.aantalVoorkomens > BEKENDE_VOORKOMENS)
    // De unieke telling dedupliceert APP-BREED, dus een nieuw gat dat een al bekende waarde
    // hergebruikt beweegt hem niet. Gemeten: 40 nieuwe ongebonden waarden in Button gaven
    // nog steeds "46 unieke ongebonden waarden", exit 0 — alleen het aantal voorkomens liep
    // op van 1906 naar 1946. Dat getal is de tweede ratel.
    fail('binding', `${gaten.aantalVoorkomens} voorkomens van een ongebonden waarde, ${BEKENDE_VOORKOMENS} bekend — `
      + `${gaten.aantalVoorkomens - BEKENDE_VOORKOMENS} nieuw(e), ook al bleef het aantal unieke waarden gelijk.`);
  else if (gaten.aantalVoorkomens < BEKENDE_VOORKOMENS)
    fail('binding', `${gaten.aantalVoorkomens} voorkomens tegen ${BEKENDE_VOORKOMENS} bekend — er is er een opgelost; zet BEKENDE_VOORKOMENS op ${gaten.aantalVoorkomens}.`);
  else ok('binding', `${n} unieke ongebonden waarden over ${gaten.aantalVoorkomens} voorkomens, gelijk aan de bekende stand (elk gat met een BACKLOG-item)`);
  if (gaten.decoratiefGenegeerd) uitgesloten.push(`${gaten.decoratiefGenegeerd} confetti-nodes — gerandomiseerd (size = 6 + random*8), geen stabiel artefact`);
}

// ---- 9. Publicatie: een herbouw mag geen gepubliceerde node vervangen --------
// De builder leegt elke pagina en maakt de nodes opnieuw. Een nieuwe node heeft een nieuwe
// key, dus elke instance die iemand uit de library plaatste raakt ontkoppeld. Zolang niets
// gepubliceerd is, is dat gratis; daarna niet meer. Deze as meet dat venster.
//
// Wat hij NIET kan zien: een publicatie van ná de laatste manifest-ververs. Het manifest is
// de enige lokale neerslag van Figma, en CI heeft geen Figma-toegang. De volgorde uit
// apps/rowtrack/CLAUDE.md (eerst verversen, dan checken) is daar de enige bescherming.
if (!manifest) sla('publicatie', 'geen manifest');
else if ((manifest.schemaVersie ?? 1) < 3)
  sla('publicatie', `manifest schema ${manifest.schemaVersie ?? 1} kent geen publishStatus — ververs via apps/rowtrack/CLAUDE.md`);
else {
  const met = Object.entries(manifest.pages).filter(([, p]) => p.primary);
  const gepubliceerd = met.filter(([, p]) => p.primary.publishStatus && p.primary.publishStatus !== 'UNPUBLISHED');
  const zonderHerkomst = gepubliceerd.filter(([, p]) => !p.primary.bouwhash);

  // De bouwspec is wat een herbouw ZOU bouwen. Is die jonger dan de Figma-momentopname, dan
  // staat er ander werk klaar dan wat er in Figma staat — precies het moment waarop een
  // herbouw gepubliceerde nodes vervangt.
  //
  // NIET via mtime. Git bewaart geen mtimes, dus een verse clone of worktree stempelt élk
  // bestand op "nu"; en `manifest.gegenereerd` heeft dagresolutie, dus een herbouw twee uur
  // ná de ververs — het echte venster — was onzichtbaar. Beide kanten gemeten 2026-09-08:
  // het uren-venster gaf groen, en een verse checkout gaf vals alarm.
  //
  // Wél via de commit-tijd: die hoort bij de INHOUD, overleeft elke checkout en heeft
  // seconderesolutie. Onvastgelegde wijzigingen aan een van beide bestanden maken de
  // vergelijking betekenisloos, dus die worden apart gemeld in plaats van meegerekend.
  const commitTijd = (rel) => {
    try {
      const t = execFileSync('git', ['log', '-1', '--format=%ct', '--', rel],
        { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return t ? Number(t) : null;
    } catch { return null; }
  };
  const vuil = (rel) => {
    try {
      return execFileSync('git', ['status', '--porcelain', '--', rel],
        { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().length > 0;
    } catch { return false; }
  };
  const specT = commitTijd('figma/build-spec.min.json');
  const manT = commitTijd('figma/manifest.json');
  const onvastgelegd = vuil('figma/build-spec.min.json') || vuil('figma/manifest.json');
  const meetbaar = specT !== null && manT !== null && !onvastgelegd;
  const specNieuwer = meetbaar && specT > manT;
  const specDatum = specT ? new Date(specT * 1000).toISOString().slice(0, 16).replace('T', ' ') : '?';
  const manifestDatum = manT ? new Date(manT * 1000).toISOString().slice(0, 16).replace('T', ' ') : (manifest.gegenereerd ?? '?');

  if (zonderHerkomst.length)
    fail('publicatie', `${zonderHerkomst.length} gepubliceerde component(en) zonder bouwhash — herkomst onbekend, `
      + `een herbouw vervangt werk dat de builder niet gemaakt heeft: ${zonderHerkomst.map(([n]) => n).join(', ')}`);
  if (gepubliceerd.length && specNieuwer)
    fail('publicatie', `${gepubliceerd.length} gepubliceerde component(en) en de bouwspec (${specDatum}) is jonger dan `
      + `de Figma-momentopname (${manifestDatum}) — herbouwen ontkoppelt elke instance. Ververs eerst het manifest.`);
  if (!zonderHerkomst.length && !(gepubliceerd.length && specNieuwer)) {
    if (!gepubliceerd.length)
      ok('publicatie', `0 van ${met.length} componenten gepubliceerd — een herbouw kost hier nog niets`);
    else if (!meetbaar)
      ok('publicatie', `${gepubliceerd.length} van ${met.length} componenten gepubliceerd, allemaal met bouwhash — `
        + (onvastgelegd ? 'de volgorde spec/momentopname is NIET gemeten: een van beide staat onvastgelegd'
                        : 'de volgorde spec/momentopname is NIET gemeten: geen git-historie'));
    else
      ok('publicatie', `${gepubliceerd.length} van ${met.length} componenten gepubliceerd, allemaal met bouwhash, `
        + `bouwspec (${specDatum}) niet jonger dan de momentopname (${manifestDatum})`);
  }
  if (gepubliceerd.length)
    uitgesloten.push('publicatie ná de laatste manifest-ververs is lokaal onzichtbaar — CI heeft geen Figma-toegang');
}

// ---- 10. Laagnamen: de laag heet naar de code, niet naar de machine ----------
// Een POSITIEVE bewering, geen zwarte lijst. De 7b-toets in de code-naar-figma-skill zocht op
// /^(Frame|Group|Rectangle|Vector) \\d+$/ en ving daarmee 1 van 11 realistische slechte namen —
// juist niet die van deze builder, die zijn nodes naar de broer-index `0`/`1`/`2` noemde en
// tekstnodes hun eigen copy liet erven omdat Figma dan `autoRename` aanzet. Gemeten vóór deze
// ronde: 82% van 1 288 frames droeg zo'n machinenaam.
if (!laagnamen) sla('laagnaam', 'geen figma/laagnamen.json — draai `pnpm --filter rowtrack figma:spec`');
else {
  const f = [];
  if (laagnamen.indexNamen > 0) f.push(`${laagnamen.indexNamen} node(s) heten een kaal cijfer — de broer-index lekt in de laagnaam`);
  if (laagnamen.copyNamen > 0) f.push(`${laagnamen.copyNamen} tekstnode(s) dragen hun eigen copy als naam — zet node.name ná node.characters, anders hernoemt autoRename mee`);
  if (laagnamen.instabiel.length) f.push(`${laagnamen.instabiel.length} isomorf variantpaar/paren met verschillende namen per positie: ${laagnamen.instabiel.slice(0, 3).join(', ')} — een component set met wisselende laagnamen is onbruikbaar`);
  // `instabiel` toetst de UITKOMST van stabiliseer() en kan daarom alleen nul zijn. Deze
  // ratel toetst de INVOER ervan — hoeveel posities de producent moest gladstrijken — en dat
  // getal normaliseert hij niet weg. Groeit het, dan is er een nieuwe naamconflict-bron.
  const ip = laagnamen.instabielePosities;
  if (ip === undefined) f.push('laagnamen.json draagt geen instabielePosities — draai `figma:spec`');
  else if (ip > BEKENDE_INSTABIELE_POSITIES)
    f.push(`${ip} posities moesten gestabiliseerd worden, ${BEKENDE_INSTABIELE_POSITIES} bekend (${(laagnamen.instabielPerComponent ?? []).join(', ')}) — een nieuwe naamconflict-bron`);
  else if (ip < BEKENDE_INSTABIELE_POSITIES)
    f.push(`${ip} posities gestabiliseerd tegen ${BEKENDE_INSTABIELE_POSITIES} bekend — een conflict is opgelost; zet BEKENDE_INSTABIELE_POSITIES op ${ip}.`);
  const pct = laagnamen.echteNaamPct;
  if (pct < LAAGNAAM_DEKKING - 0.05)
    f.push(`${pct}% van de laagnamen komt uit de code, tegen ${LAAGNAAM_DEKKING}% bekend — er is dekking verdwenen`);
  else if (pct > LAAGNAAM_DEKKING + 0.05)
    f.push(`${pct}% van de laagnamen komt uit de code, tegen ${LAAGNAAM_DEKKING}% bekend — dekking gestegen; zet LAAGNAAM_DEKKING op ${pct}.`);
  if (f.length) for (const x of f) fail('laagnaam', x);
  else ok('laagnaam', `${laagnamen.nodes} laagnamen: ${pct}% uit de code, `
    + `${(100 * laagnamen.perBron.rol / laagnamen.nodes).toFixed(1)}% uit een waargenomen rol, `
    + `${(100 * laagnamen.perBron.terugval / laagnamen.nodes).toFixed(1)}% structurele terugval — `
    + `0 cijfernamen, 0 copy-namen, ${laagnamen.instabielePosities} gestabiliseerde positie(s) `
    + `(${(laagnamen.instabielPerComponent ?? []).join(', ') || 'geen'})`);
  uitgesloten.push(`${laagnamen.perBron.terugval} nodes zonder StyleSheet-sleutel (inline of Reanimated gestyleerd) — die dragen een structurele naam, geen code-naam`);
  if (laagnamen.ambigu) uitgesloten.push(`${laagnamen.ambigu} nodes waar twee sleutels even goed passen — de eerst-gedeclareerde wint, deterministisch maar willekeurig`);
}

// ---- 11. Instancevulling: wat reist er mee naar een instance? ----------------
// Een eigen vulling op een VARIANT of op een losse COMPONENT komt mee zodra iemand de
// component in een ander bestand plaatst. Op een COMPONENT_SET komt hij NIET mee — die is een
// frame dat achter zijn varianten schildert. Dat verschil is aan de laag niet te zien en
// kostte deze library een ondoorzichtig donker vlak om elke geplaatste knop (gemeten
// 2026-09-08: `instanceFills: 1` op een Button-instance in RowTrack - Design).
if (!manifest) sla('instancevulling', 'geen manifest');
else if (Object.values(manifest.pages).some(p => p.primary && p.primary.eigenVulling === undefined))
  // `every` in plaats van `some` liet één pagina mét het veld de as groen zetten voor alle 33
  // — het beeld van een halve manifest-ververs. Gemeten: 32 onmeetbare pagina's werden als
  // "15 sets en 18 losse componenten gemeten" gerapporteerd.
  sla('instancevulling', `${Object.values(manifest.pages).filter(p => p.primary && p.primary.eigenVulling === undefined).length} `
    + 'van de pagina\'s dragen geen vullingsveld — ververs met het schema-3-recept');
else {
  const fout = [];
  for (const [naam, p] of Object.entries(manifest.pages)) {
    if (!p.primary) continue;
    if (p.primary.type === 'COMPONENT_SET') {
      if (p.primary.variantenMetVulling)
        fout.push(`${naam}: ${p.primary.variantenMetVulling} variant(en) met een eigen vulling — die reist mee naar elke instance`);
    } else if (p.primary.eigenVulling) {
      fout.push(`${naam}: losse component met een eigen vulling — zet hem op een achtergrond-rechthoek erachter`);
    }
  }
  if (fout.length) for (const f of fout) fail('instancevulling', f);
  else {
    const sets = Object.values(manifest.pages).filter(p => p.primary?.type === 'COMPONENT_SET');
    ok('instancevulling', `${sets.length} sets en ${Object.values(manifest.pages).length - sets.length} losse componenten: `
      + 'geen enkele variant of losse component draagt een eigen vulling, dus een instance komt transparant mee');
  }
}

// ---- Rapport ----------------------------------------------------------------
console.log('figma-sync-check — apps/rowtrack ↔ Figma "%s" (%s)\n',
  manifest?.fileName ?? '?', manifest?.fileKey ?? '?');
for (const c of checks) console.log('  ok   ' + c);
for (const u of uitgesloten) console.log('  --   [uitgesloten] ' + u);
for (const o of overgeslagen) console.log('  ~~   ' + o);
if (fails.length) {
  console.log('');
  for (const f of fails) console.log('  FAIL ' + f);
  console.log(`\n${fails.length} verschil(len). Code en Figma staan niet in sync.`);
  console.log('Fix de code, of werk Figma bij en ververs figma/manifest.json (zie apps/rowtrack/CLAUDE.md → Verify-pad).');
  process.exit(1);
}
// De slotregel somde tot 2026-09-08 alle dertien assen bij naam op, ongeacht hoeveel er
// gedraaid hadden. Gemeten: een kopie zónder figma/manifest.json gaf tien overgeslagen assen,
// vier groen, EXIT 0, en toch de volledige opsomming. Wie de exit-code leest of het commando
// aan een `&&` hangt, krijgt "in sync" van een meting die grotendeels niet plaatsvond.
// De opsomming komt nu uit `checks` zelf, en een onvolledige meting krijgt een eigen
// exit-code — 2 betekent "niet gemeten", 1 betekent "gemeten en verschillend".
console.log(`\n${checks.length} van ${ASSEN.length} assen groen: ${checks.map(c => c.match(/^\[([^\]]+)\]/)?.[1] ?? c).join(', ')}.`);
console.log('Niet gemeten: of Figma er hetzelfde UITZIET als de browser (dat is `pnpm --filter rowtrack parity`),');
console.log('wat de bouwspec afkapte (voorbij diepte 4 of 8 broers), en elke Figma-wijziging sinds '
  + (manifest?.gegenereerd ?? 'de laatste ververs') + '.');
if (overgeslagen.length) {
  console.log(`\n${overgeslagen.length} as(sen) OVERGESLAGEN — zie de ~~-regels hierboven.`);
  console.log('Dit is geen groene meting: de invoer voor die assen ontbrak. Exit 2.');
  process.exit(2);
}
