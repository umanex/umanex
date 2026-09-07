#!/usr/bin/env node
/**
 * Vertaalt apps/rowtrack/tokens/tokens.json naar de payload die het Figma-bestand
 * "RowTrack — Design System" moet dragen: variabelen, text styles en effect styles.
 *
 * DE RICHTING IS ÉÉNZIJDIG. tokens.json is het Tokens Studio sync-target en de enige bron;
 * dit script leest en schrijft nooit terug. Wat hier niet uit volgt, hoort niet in Figma —
 * dat is de regel die het vorige bestand overtrad (een cyaan/Inter-palet dat nergens
 * vandaan kwam, gemeten 2026-09-07).
 *
 * WAT WORDT WAT, en waarom:
 *   color/borderRadius/borderWidth/sizing/spacing/fontSizes/opacity/
 *   letterSpacing/lineHeights/fontFamilies/fontWeights  -> VARIABELE
 *   typography  -> TEXT STYLE   (een compositie; Figma heeft er geen variabeletype voor)
 *   boxShadow   -> EFFECT STYLE (idem)
 *
 * Een `{ref}` in de bron wordt een Figma-ALIAS, geen gekopieerde waarde. Daardoor draagt
 * Figma dezelfde afhankelijkheidsboom als de code: wijzigt Core/color/red/600, dan schuift
 * Theme/accent/default mee. Een gekopieerde waarde zou stil uit elkaar lopen.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const bron = JSON.parse(readFileSync(join(APP, 'tokens/tokens.json'), 'utf8'));
const SETS = bron.$metadata?.tokenSetOrder ?? ['Core', 'Theme', 'Component'];

/** Alle leaves per set, als pad -> token. */
const perSet = {};
const alleLeaves = {};                 // 'set/pad' -> token, voor referentie-oplossing
for (const set of SETS) {
  perSet[set] = {};
  (function loop(o, p) {
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith('$')) continue;
      if (!v || typeof v !== 'object') continue;
      if (v.$value !== undefined) { perSet[set][p + k] = v; alleLeaves[p + k] = { set, token: v }; }
      else loop(v, p + k + '/');
    }
  })(bron[set], '');
}

const VARIABELE_TYPE = {
  color: 'COLOR',
  borderRadius: 'FLOAT', borderWidth: 'FLOAT', sizing: 'FLOAT', spacing: 'FLOAT',
  fontSizes: 'FLOAT', opacity: 'FLOAT', letterSpacing: 'FLOAT', lineHeights: 'FLOAT',
  fontFamilies: 'STRING', fontWeights: 'STRING',
};
const STYLE_TYPE = { typography: 'TEXT', boxShadow: 'EFFECT' };

/** '{color.neutral.950}' -> 'color/neutral/950'. Geen referentie -> null. */
const refPad = (v) => (typeof v === 'string' && /^\{[^}]+\}$/.test(v.trim()))
  ? v.trim().slice(1, -1).split('.').join('/') : null;

/** In welke set staat dit pad? De sets zijn disjunct op pad-niveau. */
function setVan(pad) {
  const hit = alleLeaves[pad];
  if (!hit) throw new Error(`[figma-tokens] referentie naar onbekend pad: ${pad}`);
  return hit.set;
}

/** Lost een keten van referenties op tot de letterlijke waarde. */
function plat(waarde, diepte = 0) {
  if (diepte > 12) throw new Error('[figma-tokens] referentielus');
  const p = refPad(waarde);
  if (!p) return waarde;
  return plat(alleLeaves[p].token.$value, diepte + 1);
}

/** '#F05454' of 'rgba(240, 84, 84, 0.2)' -> Figma RGBA (0–1). */
function kleur(t) {
  const s = String(t).trim();
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const d = m[1].split(',').map(x => parseFloat(x.trim()));
    return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] ?? 1 };
  }
  const h = s.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-f]{6,8}$/i.test(n)) throw new Error(`[figma-tokens] geen kleur: ${s}`);
  return {
    r: parseInt(n.slice(0, 2), 16) / 255, g: parseInt(n.slice(2, 4), 16) / 255,
    b: parseInt(n.slice(4, 6), 16) / 255, a: n.length === 8 ? parseInt(n.slice(6, 8), 16) / 255 : 1,
  };
}

/** '95%' -> 95, '-4.5%' -> -4.5, '18' -> 18. De eenheid zit in het tokentype. */
const getal = (t) => {
  const n = parseFloat(String(t).replace('%', ''));
  if (Number.isNaN(n)) throw new Error(`[figma-tokens] geen getal: ${t}`);
  return n;
};

// ---------------------------------------------------------------------------
// Wat de app WERKELIJK rendert — nodig vóór de variabelen, want één tokenwaarde
// is een opzoeksleutel en geen echte waarde. Zie RENDER_FAMILIE hieronder.
// ---------------------------------------------------------------------------
const typo = await import(new URL('../constants/typography.ts', import.meta.url).href);

/**
 * Tokensleutel -> de familie die de app echt laadt.
 *
 * `Core/fontFamily/sourceSerif` staat in de bron als "Source Serif Pro", maar dat is de
 * `tokenFamily`-sleutel waarmee style-dictionary.config.mjs de FONTS-tabel opzoekt; die
 * tabel wijst hem naar expoBase `SourceSerif4`, en de app rendert dus Source Serif 4.
 * Adobe hernoemde Source Serif Pro in 2021 naar Source Serif 4 — beide staan als aparte
 * familie in Figma (gemeten 2026-09-07: Pro zonder Medium, 4 mét). De tokenwaarde
 * letterlijk overnemen zou Figma een ander lettertype laten renderen dan de app, zonder
 * één foutmelding. De variabele draagt daarom de GERENDERDE familie.
 *
 * Dit is een afwijking van de bron en staat als zodanig in BACKLOG.md: de nette fix is
 * `Core/fontFamily/sourceSerif` in Tokens Studio op "Source Serif 4" zetten, waarna deze
 * afleiding een no-op wordt in plaats van een correctie.
 */
const RENDER_FAMILIE = {};
{
  // constants/fontFamily mapt tokensleutel+gewicht -> expo-variant (sourceSerifRegular ->
  // SourceSerif4_400Regular). De expoBase daaruit is de familie zonder spaties.
  for (const [sleutel, variant] of Object.entries(typo.fontFamily)) {
    const expoBase = String(variant).split('_')[0];
    // 'sourceSerifRegular' -> tokensleutel 'sourceSerif'; de gewichtsstaart eraf.
    const tokenSleutel = sleutel.replace(/(Regular|Italic|SemiBold|Medium|Light|Bold|ExtraBold)$/, '');
    if (tokenSleutel) RENDER_FAMILIE[tokenSleutel] ??= expoBase;
  }
}

// ---------------------------------------------------------------------------
// Variabelen
// ---------------------------------------------------------------------------
const collecties = {};
const overgeslagen = [];
for (const set of SETS) {
  collecties[set] = { mode: 'Value', variabelen: [] };
  for (const [pad, tok] of Object.entries(perSet[set])) {
    const vt = VARIABELE_TYPE[tok.$type];
    if (!vt) {
      if (!STYLE_TYPE[tok.$type]) overgeslagen.push(`${set}/${pad} (${tok.$type})`);
      continue;
    }
    const ref = refPad(tok.$value);
    const item = { naam: pad, type: vt, beschrijving: tok.$description ?? '' };
    if (ref) { item.alias = { set: setVan(ref), naam: ref }; }
    else if (vt === 'COLOR') item.waarde = kleur(tok.$value);
    else if (vt === 'FLOAT') item.waarde = getal(tok.$value);
    else if (tok.$type === 'fontFamilies') {
      const sleutel = pad.split('/').pop();
      const expoBase = RENDER_FAMILIE[sleutel];
      if (!expoBase) throw new Error(`[figma-tokens] geen gerenderde familie voor ${pad}`);
      item.waarde = String(tok.$value);          // de tokenwaarde, ter vergelijking
      item.expoBase = expoBase;                  // de Figma-kant lost de familienaam hiermee op
      item.wijktAfVanBron = expoBase.replace(/\s+/g, '') !== String(tok.$value).replace(/\s+/g, '');
    }
    else item.waarde = String(tok.$value);
    collecties[set].variabelen.push(item);
  }
}

// ---------------------------------------------------------------------------
// Text styles — uit de GERENDERDE typeStyles, met bindingen uit de tokens
// ---------------------------------------------------------------------------
//
// WAAROM NIET RECHTSTREEKS UIT tokens.json. De tokenwaarde is niet wat de app toont.
// Drie gemeten verschillen op 2026-09-07:
//
//  1. `Core/fontFamily/sourceSerif` = "Source Serif Pro", maar de app rendert
//     `SourceSerif4_400Regular` — Source Serif 4. Beide families bestaan in Figma, dus de
//     tokennaam letterlijk overnemen geeft een ander lettertype zonder één foutmelding.
//     De tokenwaarde is een OPZOEKSLEUTEL in de FONTS-tabel, geen Figma-familienaam.
//  2. `lineHeight` valt in de build weg zodra hij ≤ fontSize is (heroNumeric: 95% van 114
//     = 108,3 < 114). RN gebruikt dan de natuurlijke regelhoogte; het Figma-equivalent is
//     AUTO, niet 95%. Een letterlijke 95% zou elke hero-regel 5,7px te krap zetten.
//  3. `letterSpacing` staat in de bron als percentage en in de render als px.
//     PERCENT is in Figma exact equivalent (114 × −4,5% = −5,13) én houdt de binding
//     leesbaar, dus die kant wint — maar alleen omdat hij is nagerekend.
//
// De 20 Component-typografie-tokens zijn alle 20 een pure ref naar Theme/type (gemeten),
// dus ze krijgen GEEN eigen text style. Ze staan als alias in de payload, zodat de guard
// het verschil ziet tussen "afgeleid" en "vergeten".
const themeType = perSet.Theme;

const textStyles = [];
for (const [pad, tok] of Object.entries(themeType)) {
  if (tok.$type !== 'typography') continue;
  const sleutel = pad.replace(/^type\//, '');
  const gerenderd = typo.typeStyles[sleutel];
  if (!gerenderd) throw new Error(`[figma-tokens] Theme/${pad} heeft geen typeStyles.${sleutel}`);
  const v = tok.$value;
  textStyles.push({
    naam: `type/${sleutel}`,
    // De expo-variantnaam is de brug: de Figma-kant zoekt de familie op door de spaties
    // uit de beschikbare fontnamen te halen en te vergelijken. Geen vertaaltabel hier,
    // want die zou een derde bron van waarheid zijn.
    expoVariant: gerenderd.fontFamily,
    fontSize: gerenderd.fontSize,
    lineHeight: gerenderd.lineHeight ?? null,        // px, of null -> AUTO
    letterSpacingPct: v.letterSpacing !== undefined ? getal(plat(v.letterSpacing)) : null,
    letterSpacingPx: gerenderd.letterSpacing ?? null, // ter controle van de PERCENT-keuze
    binding: {
      fontFamily: refPad(v.fontFamily), fontSize: refPad(v.fontSize),
      lineHeight: gerenderd.lineHeight != null ? refPad(v.lineHeight) : null,
      letterSpacing: refPad(v.letterSpacing), fontWeight: refPad(v.fontWeight),
    },
    beschrijving: tok.$description ?? '',
  });
}

// ---------------------------------------------------------------------------
// Effect styles — uit elk boxShadow-token in Theme
// ---------------------------------------------------------------------------
const TYPE_VAN_SCHADUW = { innerShadow: 'INNER_SHADOW', dropShadow: 'DROP_SHADOW' };
const effectStyles = [];
for (const [pad, tok] of Object.entries(perSet.Theme)) {
  if (tok.$type !== 'boxShadow') continue;
  // De bron levert soms één object en soms een array — gemeten: buttonOutline is één laag,
  // buttonPrimary vier. Normaliseren, niet aannemen.
  const ruw = tok.$value;
  const lagen = (Array.isArray(ruw) ? ruw : [ruw]).map(l => ({
    type: TYPE_VAN_SCHADUW[l.type] ?? 'DROP_SHADOW',
    offset: { x: getal(l.x), y: getal(l.y) },
    radius: getal(l.blur), spread: getal(l.spread ?? 0),
    color: kleur(plat(l.color)),
    colorRef: refPad(l.color),
  }));
  effectStyles.push({ naam: pad, lagen, beschrijving: tok.$description ?? '' });
}

// Aliassen: Component-tokens die naar een Theme-style wijzen. Expliciet in de payload,
// zodat "afgeleid" niet als "ontbreekt" gelezen wordt.
const styleAliassen = [];
for (const [pad, tok] of Object.entries(perSet.Component)) {
  if (tok.$type !== 'typography' && tok.$type !== 'boxShadow') continue;
  const doel = refPad(tok.$value);
  if (!doel) throw new Error(`[figma-tokens] Component/${pad} is geen alias maar een eigen ${tok.$type}`);
  styleAliassen.push({ naam: pad, soort: tok.$type, wijstNaar: doel });
}

const payload = {
  $comment: 'GEGENEREERD door scripts/figma-tokens-payload.mjs uit tokens/tokens.json. Niet met de hand bewerken.',
  fileKey: 'QkRgMc7Quqtbow71DiYa1n',
  collecties, textStyles, effectStyles, styleAliassen,
};
mkdirSync(join(APP, 'figma'), { recursive: true });
writeFileSync(join(APP, 'figma/tokens-payload.json'), JSON.stringify(payload, null, 1));

const telVar = Object.values(collecties).reduce((n, c) => n + c.variabelen.length, 0);
console.log(`variabelen : ${telVar}  (${SETS.map(s => `${s} ${collecties[s].variabelen.length}`).join(', ')})`);
console.log(`text styles: ${textStyles.length}   (uit Theme/type)`);
console.log(`effects    : ${effectStyles.length}   (uit Theme/shadow)`);
console.log(`aliassen   : ${styleAliassen.length}   (Component -> Theme, geen eigen style)`);
const totaal = telVar + textStyles.length + effectStyles.length + styleAliassen.length;
const leaves = Object.values(perSet).reduce((n, s2) => n + Object.keys(s2).length, 0);
console.log(`totaal     : ${totaal} van ${leaves} leaves` + (totaal === leaves ? '  — alles verantwoord' : '  *** GAT ***'));
if (totaal !== leaves) process.exitCode = 1;
const afwijkend = Object.values(collecties).flatMap(c => c.variabelen).filter(v => v.wijktAfVanBron);
if (afwijkend.length) {
  console.log('AFWIJKING bron -> render (bewust, zie BACKLOG.md):');
  for (const a of afwijkend) console.log(`  ${a.naam}: token "${a.waarde}" -> rendert als ${a.expoBase}`);
}
if (overgeslagen.length) { console.log('OVERGESLAGEN (onbekend type):'); for (const o of overgeslagen) console.log('  ' + o); }
