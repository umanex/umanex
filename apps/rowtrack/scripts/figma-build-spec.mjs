#!/usr/bin/env node
/**
 * Leidt per component en per variant-combinatie een Figma-bouwspec af uit de GERENDERDE DOM.
 *
 * WAAROM UIT DE RENDER EN NIET UIT DE TSX. De code is de bron, maar de render is wat de code
 * OPLEVERT — inclusief alles wat StyleSheet.create, react-native-web en de tokenbuild ermee
 * doen. Een spec uit de render nateken-en maakt de parity-as per constructie waar in plaats
 * van hoopvol. Het risico dat de `code-naar-figma`-skill benoemt (principe 3: transcriptie,
 * geen benadering) gaat over VERZONNEN waarden; hier wordt niets verzonnen — elke waarde
 * komt uit een meting van het component zelf.
 *
 * EN ELKE WAARDE BINDT. Iedere gemeten kleur, maat, radius, spacing en regelhoogte wordt
 * opgezocht in de drie variabelen-collecties (exacte waarde-match, Component vóór Theme vóór
 * Core zodat de meest specifieke rol wint). Wat géén tokenmatch heeft komt in `ongebonden`
 * te staan en wordt gerapporteerd — nooit stil als rauw getal weggeschreven.
 *
 * Uitvoer: figma/build-spec.json
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { benoem } from './laagnamen.mjs';
import { SCHERMEN as SCHERMEN_BRON } from './schermen.mjs';


import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * `--hernoem` draait ALLEEN de naamgevingspas opnieuw, op de bestaande figma/build-spec.json.
 *
 * De kandidaten per node staan al in die spec, dus een naamiteratie hoeft de 118 varianten
 * niet opnieuw in Chromium te renderen. Dat scheelt twee minuten per ronde en, belangrijker,
 * het houdt de meting constant: je verandert de naamregel en niets anders.
 */
if (process.argv.includes('--hernoem')) {
  const specPad = join(APP, 'figma/build-spec.json');
  const spec = JSON.parse(readFileSync(specPad, 'utf8'));
  let n = 0;
  spec.naamStats = [];
  for (const [comp, d] of Object.entries(spec.componenten)) { spec.naamStats.push(...benoemAlles(comp, d.varianten)); n++; }
  for (const [comp, d] of Object.entries(spec.schermen)) { spec.naamStats.push(...benoemAlles(comp, d.frames)); n++; }
  writeFileSync(specPad, JSON.stringify(spec, null, 1));
  console.log(`hernoemd: ${n} componenten in figma/build-spec.json — draai nu figma-build-prune.mjs`);
  process.exit(0);
}

const STATIC = join(APP, 'storybook-static');
const assen = JSON.parse(readFileSync(join(APP, 'figma/story-axes.json'), 'utf8'));
const payload = JSON.parse(readFileSync(join(APP, 'figma/tokens-payload.json'), 'utf8'));

// Componenten die als SCHERM gemodelleerd worden: representatieve frames in plaats van een
// component set. Besluit Jeroen 2026-09-07 — hun assen zijn statusenums die in beeld niet
// orthogonaal zijn (bij bleStatus='error' ziet hrStatus er in de meeste combinaties identiek
// uit), en de productregel zou 320 respectievelijk 160 nodes eisen voor twee schermen.
// De schermenlijst staat in scripts/schermen.mjs — één bron voor build-spec, sync-check en
// figma-links. Hier alleen de frame-namen eruit.
const SCHERMEN = Object.fromEntries(Object.entries(SCHERMEN_BRON).map(([k, v]) => [k, v.frames]));

/**
 * Assen die de code kent maar die GEEN visuele variant zijn. Elke uitsluiting is een
 * oordeel dat de guard daarna als waarheid vastlegt, dus ze staan hier met hun reden en
 * niet in een configbestand — bij het lezen van het script komen ze vanzelf langs.
 *
 * `visible` is een MOUNT-schakelaar: bij false rendert het component niets. Gemeten
 * 2026-09-07 op DeviceSelectionModal (visible=false gaf 0 nodes, twee keer). Een
 * variant-node voor de false-kant zou een leeg frame in Figma zijn — een vorm die er
 * identiek uitziet als een mislukte build.
 */
const NIET_VISUEEL = {
  'BottomSheet.visible': 'mount-schakelaar — bij false rendert het component niets',
  'GoalSheet.visible': 'mount-schakelaar — bij false rendert het component niets',
  'HealthConsentScreen.visible': 'mount-schakelaar — bij false rendert het component niets',
  'DeviceSelectionModal.visible': 'mount-schakelaar — bij false rendert het component niets',
};

// ---------------------------------------------------------------------------
// Waarde -> variabele. Exacte match; specifiek vóór algemeen.
// ---------------------------------------------------------------------------
/**
 * Waarde -> variabele, BEPERKT PER EIGENSCHAPSSOORT.
 *
 * Een kale waarde-match is fout, en de Chip liet zien hoe fout: `padding: 0` matchte op
 * `Core/letterSpacing/normal` (ook 0) en `padding: 8` op `Component/button/primary/radius`
 * (ook 8). Semantisch onzin, en in Figma niet te zien — de binding staat er, dus de gate
 * meldt groen. Gemeten 2026-09-07.
 *
 * Daarom eerst een KANDIDATENPOOL per soort, en pas daarbinnen de waarde-match. De volgorde
 * binnen de pool volgt hoe de code consumeert: een Component-token waarvan het eerste
 * padsegment dít component is wint (Button gebruikt buttonTokens.*), anders de Theme-rol
 * (de laag waar app-code hoort te zitten), anders Core, en pas als laatste een willekeurig
 * Component-token — dat laatste wordt als zwakke match gemeld.
 */
const alleVars = [];
{
  const perSet = {};
  for (const [set, c] of Object.entries(payload.collecties)) perSet[set] = new Map(c.variabelen.map(v => [v.naam, v]));
  const los = (set, naam, d = 0) => {
    if (d > 12) return null;
    const v = perSet[set]?.get(naam);
    if (!v) return null;
    return v.alias ? los(v.alias.set, v.alias.naam, d + 1) : v;
  };
  for (const set of ['Core', 'Theme', 'Component']) {
    for (const v of payload.collecties[set].variabelen) {
      const w = los(set, v.naam);
      if (!w) continue;
      alleVars.push({ ref: `${set}:${v.naam}`, set, naam: v.naam, type: w.type, waarde: w.waarde });
    }
  }
}

/** Welke tokenpaden mogen voor welke eigenschap in aanmerking komen. */
const POOL = {
  spacing: v => /^spacing\//.test(v.naam) || /\/(padding|paddingX|paddingY|paddingTop|paddingBottom|paddingLeft|paddingRight|gap|itemGap|marginBottom|unitOffsetLeft)$/i.test(v.naam),
  radius:  v => /^borderRadius\//.test(v.naam) || /^radius\//.test(v.naam) || /\/radius$/i.test(v.naam),
  breedte: v => /^borderWidth\//.test(v.naam) || /^stroke\//.test(v.naam) || /Width$/i.test(v.naam),
  maat:    v => /^sizing\//.test(v.naam) || /^size\//.test(v.naam) || /\/(height|markerSize|trackHeight|fillHeight|indicatorHeight)$/i.test(v.naam),
};

const normComp = s2 => String(s2).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Kies de beste variabele voor een waarde binnen een pool. */
function kies(pool, test, comp, zwakMelden) {
  const kandidaten = alleVars.filter(v => POOL[pool](v) && test(v));
  if (!kandidaten.length) return null;
  const c = normComp(comp);
  const eigen = kandidaten.find(v => v.set === 'Component' && normComp(v.naam.split('/')[0]) === c);
  if (eigen) return eigen.ref;
  const theme = kandidaten.find(v => v.set === 'Theme');
  if (theme) return theme.ref;
  const core = kandidaten.find(v => v.set === 'Core');
  if (core) return core.ref;
  if (zwakMelden) zwakMelden(kandidaten[0].ref);
  return kandidaten[0].ref;
}

/** 'linear-gradient(90deg, rgb(a), rgba(b))' -> { hoek, stops[] }. Geen hoek = 180 (naar onder). */
function ontleedGradient(css) {
  const m = String(css).match(/linear-gradient\(([^]*)\)\s*$/);
  if (!m) return null;
  // Splits op komma's die NIET binnen rgb()/rgba() staan.
  const delen = [];
  let diepte = 0, huidig = '';
  for (const ch of m[1]) {
    if (ch === '(') diepte++;
    if (ch === ')') diepte--;
    if (ch === ',' && diepte === 0) { delen.push(huidig.trim()); huidig = ''; continue; }
    huidig += ch;
  }
  if (huidig.trim()) delen.push(huidig.trim());
  let hoek = 180;
  if (/^-?[\d.]+deg$/.test(delen[0])) hoek = parseFloat(delen.shift());
  else if (/^to\s/.test(delen[0])) { const r = delen.shift(); hoek = /right/.test(r) ? 90 : /left/.test(r) ? 270 : /top/.test(r) ? 0 : 180; }
  const stops = delen.map(d => {
    const c = d.match(/rgba?\(([^)]+)\)/);
    if (!c) return null;
    const v = c[1].split(',').map(x => parseFloat(x.trim()));
    return { r: v[0], g: v[1], b: v[2], a: v[3] ?? 1 };
  }).filter(Boolean);
  return stops.length >= 2 ? { hoek, stops } : null;
}

const gelijkKleur = (a, b) => a && b && Math.abs(a.r * 255 - b.r) < 0.6 && Math.abs(a.g * 255 - b.g) < 0.6
  && Math.abs(a.b * 255 - b.b) < 0.6 && Math.abs((a.a ?? 1) - b.a) < 0.01;

/** Kleur: geen pool-beperking (elke COLOR mag), wel dezelfde voorkeursvolgorde. */
function kiesKleur(k, comp) {
  const kandidaten = alleVars.filter(v => v.type === 'COLOR' && gelijkKleur(v.waarde, k));
  if (!kandidaten.length) return null;
  const c = normComp(comp);
  return (kandidaten.find(v => v.set === 'Component' && normComp(v.naam.split('/')[0]) === c)
       ?? kandidaten.find(v => v.set === 'Theme')
       ?? kandidaten.find(v => v.set === 'Core')
       ?? kandidaten[0]).ref;
}
const kiesGetal = (pool, n, comp) => kies(pool, v => v.type === 'FLOAT' && v.waarde === n, comp);

// ---------------------------------------------------------------------------
// Statische server + browser
// ---------------------------------------------------------------------------
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff',
  '.ttf':'font/ttf','.png':'image/png','.map':'application/json' };
const server = createServer((q, r) => {
  let p = join(STATIC, decodeURIComponent(q.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { r.writeHead(404); return r.end('404'); }
  r.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' });
  r.end(readFileSync(p));
});
await new Promise(r => server.listen(0, r));
const poort = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 } });  // iPhone-breedte

/** Alle combinaties van de assen, als lijst van {naam, args}. */
function combinaties(assenObj) {
  const namen = Object.keys(assenObj);
  if (!namen.length) return [{ naam: 'default', args: {} }];
  let uit = [{}];
  for (const n of namen) {
    const nieuw = [];
    for (const basis of uit) for (const w of assenObj[n]) nieuw.push({ ...basis, [n]: w });
    uit = nieuw;
  }
  return uit.map(args => ({
    naam: namen.map(n => `${n}=${args[n]}`).join(', '),
    args,
  }));
}

/** Storybook-args in de URL: booleans als !true/!false. */
/**
 * Namen toekennen aan een component: eerst de hoofdbomen, dan de overlays als eigen groep.
 *
 * Een overlay (een <Modal>-portal) is een APARTE boom naast de schermboom, geen kind ervan.
 * Ze samen in één `benoem()` gooien zou `stabiliseer()` een schermboom tegen een modalboom
 * laten vergelijken; apart houden laat hem de modal van variant A tegen die van variant B
 * leggen, wat wél dezelfde vorm is.
 */
function benoemAlles(comp, items) {
  const stats = [benoem(comp, items.map(x => x.boom))];
  const alleOverlays = items.flatMap(x => x.overlays ?? []);
  if (alleOverlays.length) stats.push(benoem(comp, alleOverlays));
  return stats;
}

const argsQuery = args => Object.entries(args)
  .map(([k, v]) => `${k}:${typeof v === 'boolean' ? '!' + v : v}`).join(';');

// De DOM-walker draait in de pagina. Hij levert een boom met rauwe waarden; het mappen naar
// variabelen gebeurt in Node, zodat de tokenkennis op één plek staat.
const WALKER = () => {
  /**
   * De sleutelkaart is een MEETINSTRUMENT, geen bron die leeg mag zijn. Een lege kaart en
   * "dit component heeft geen StyleSheet-sleutels" zien er identiek uit; het verschil is
   * alleen te zien door hier hard te falen. `.storybook/rnw-style-keys.ts` vult hem.
   */
  const kaart = window.__RNW_KEYS__;
  if (!kaart) return { fout: 'geen window.__RNW_KEYS__ — .storybook/rnw-style-keys.ts niet geladen' };
  if (kaart.uit) return { fout: 'sleutelkaart uitgeschakeld (?rnwKeysUit=1)' };
  if (!kaart.actief) return { fout: 'StyleSheet.create niet gewrapt — de aftap hing er niet in' };
  if (kaart.fouten.length && !kaart.bronnen.length)
    return { fout: `sleutelkaart leeg met fouten: ${kaart.fouten.slice(0, 2).join(' | ')}` };
  // Nul bronnen zónder fouten is GELDIG: `Icon` doet geen enkele StyleSheet.create-aanroep.
  // Elke node valt dan terug op de ladder, en dat is de juiste uitkomst — geen meetfout.

  // Alleen app-code doet mee. De wrapper wist de herkomst na elke lezing, dus een aanroep
  // uit react-native-web zelf komt hier per constructie niet in.
  const sleutelIndex = [];
  for (const b of kaart.bronnen)
    for (const s of b.sleutels)
      sleutelIndex.push({ bronId: b.id, bron: b.bron, naam: s.naam, volgorde: s.volgorde,
                          klassen: new Set(s.klassen) });

  const root = document.querySelector('#storybook-root');
  const decorator = root?.firstElementChild;
  if (!decorator) return { fout: 'geen decorator' };
  let kinderen = [...decorator.children];

  // Een <Modal> portaleert in react-native-web BUITEN #storybook-root, naar document.body.
  // Anker op INHOUD, niet op afmeting: de portal-wortel heeft hoogte 0 omdat de modal erin
  // absoluut gepositioneerd is. Een filter op `height > 0` sneed hem precies weg (gemeten
  // 2026-09-07 — eerste poging vond nul portals terwijl er één stond). Storybook's eigen
  // wrappers dragen een id of een sb-class; de portal geen van beide.
  const portalen = [...document.body.children].filter(el =>
    el.tagName !== 'SCRIPT' && el.tagName !== 'SVG' && el.tagName !== 'svg' &&
    !el.id && !/\bsb-/.test(String(el.className || '')) &&
    !el.contains(root) && (el.textContent || '').trim().length > 0);

  // Een <Modal>-sheet laat soms WEL een kind in de decorator achter, maar een leeg kind van
  // 0x0: BottomSheet, GoalSheet en HealthConsentScreen deden dat (gemeten 2026-09-07).
  if (kinderen.length === 1) {
    const r0 = kinderen[0].getBoundingClientRect();
    if (r0.width < 2 && r0.height < 2 && kinderen[0].children.length === 0) kinderen = [];
  }

  // WAT ER TOT 2026-09-08 MISGING: de portal werd alléén geraadpleegd als de decorator leeg
  // was. Een SCHERM met een modal erover heeft allebei — en dan viel de modal weg. Gemeten
  // op de gecommitte spec: de ActivePhase-frames Playground, Doel Bereikt en Samenvatting
  // hadden alle drie 45 nodes met exact dezelfde teksthash, want de summary-Modal en de
  // toast bestonden voor de walker niet. Vier componenten uit de refactor (SummaryTitle,
  // PrBanner, SummaryKpiBand, StatsTable) hadden daardoor nul schermmeting.
  //
  // Nu: de decorator-inhoud is de BOOM, de portalen zijn OVERLAYS die er absoluut overheen
  // liggen — precies wat de DOM doet, en wat je in Figma wil zien.
  let overlays = [];
  if (kinderen.length === 0) {
    if (portalen.length === 1) kinderen = [portalen[0]];
    else if (portalen.length > 1) return { fout: `${portalen.length} portal-wortels buiten #storybook-root` };
  } else {
    overlays = portalen;
  }
  if (kinderen.length !== 1) return { fout: `verwacht 1 kind onder de decorator, kreeg ${kinderen.length}` };

  const px = v => { const n = parseFloat(v); return Number.isNaN(n) ? 0 : n; };
  const rgba = v => {
    const m = String(v).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const d = m[1].split(',').map(x => parseFloat(x.trim()));
    return { r: d[0], g: d[1], b: d[2], a: d[3] ?? 1 };
  };
  /**
   * Een DOORVOER-WRAPPER draagt geen ontwerpinformatie: precies één elementkind, geen eigen
   * tekst, en geen eigen verf (achtergrond, verloop, rand, schaduw, radius, opacity). In RN
   * levert elke <View> er een, en een portal-constructie stapelt er drie tot vier op elkaar.
   *
   * Zulke wrappers mogen GEEN diepte kosten. Gemeten 2026-09-08: met een vast budget van 6
   * aten ze het hele budget op vóór de inhoud begon, en stonden BottomSheet, GoalSheet,
   * HealthConsentScreen, MotivationalToast en DeviceSelectionModal met NUL tekstnodes in de
   * spec — in Figma dus een leeg frame. De boom zag er intact uit; alleen de inhoud ontbrak.
   */
  function isDoorvoer(el, cs) {
    if (el.children.length !== 1) return false;
    if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return false;
    const bg = rgba(cs.backgroundColor);
    if (bg && bg.a > 0) return false;
    if (cs.backgroundImage !== 'none') return false;
    if (px(cs.borderTopWidth) > 0) return false;
    if (cs.boxShadow !== 'none') return false;
    if (px(cs.borderTopLeftRadius) > 0) return false;
    if (parseFloat(cs.opacity) < 1) return false;
    return true;
  }

  function lees(el, diepte, ouderRect) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const eigenTekst = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim())
      .map(n => n.textContent).join('');
    const o = {
      tag: el.tagName.toLowerCase(),
      w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100,
      display: cs.display,
      richting: cs.flexDirection, gap: px(cs.gap) || px(cs.columnGap) || 0,
      justify: cs.justifyContent, align: cs.alignItems,
      padding: [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)],
      radius: [px(cs.borderTopLeftRadius), px(cs.borderTopRightRadius),
               px(cs.borderBottomRightRadius), px(cs.borderBottomLeftRadius)],
      bg: rgba(cs.backgroundColor),
      backgroundImage: cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 260) : null,
      borderWidth: px(cs.borderTopWidth),
      borderColor: px(cs.borderTopWidth) > 0 ? rgba(cs.borderTopColor) : null,
      opacity: parseFloat(cs.opacity),
      boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : null,
      overflow: cs.overflow,
      positie: cs.position,
      // Offset t.o.v. de ouder. Nodig voor een absoluut gepositioneerd kind: dat valt
      // buiten de auto-layout-stroom en moet in Figma op zijn eigen plek gezet worden.
      dx: ouderRect ? Math.round((r.left - ouderRect.left) * 100) / 100 : 0,
      dy: ouderRect ? Math.round((r.top - ouderRect.top) * 100) / 100 : 0,
    };
    if (eigenTekst) {
      o.tekst = {
        inhoud: eigenTekst,
        family: cs.fontFamily.replace(/["']/g, '').split(',')[0].trim(),
        size: px(cs.fontSize),
        lineHeight: cs.lineHeight === 'normal' ? null : px(cs.lineHeight),
        letterSpacing: cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing),
        kleur: rgba(cs.color),
        align: cs.textAlign,
        transform: cs.textTransform,
      };
    }
    // Welke StyleSheet-sleutels verklaren de klassen van deze node? De klassen zijn atomair
    // en `styleq` gooit overschreven klassen wég, dus een basisstijl is nooit volledig
    // aanwezig zodra een modifier hem raakt (PrBadge: `badgeSm` overschrijft 4 van `badge`'s
    // 8 properties). Daarom OVERLAP en geen subset. De drempel wordt in Node gelegd, uit de
    // verdeling in figma/laagnamen.json — hier wordt alleen gemeten.
    const klassen = String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    const rk = new Set(klassen.filter(c => c.startsWith('r-')));
    o.rol = el.getAttribute('role') || null;
    o.kandidaten = [];
    for (const k of sleutelIndex) {
      const eigen = [];
      for (const c of k.klassen) if (rk.has(c)) eigen.push(c);
      if (eigen.length)
        o.kandidaten.push({ b: k.bronId, bron: k.bron, s: k.naam, v: k.volgorde, n: k.klassen.size, eigen });
    }

    if (el.tagName.toLowerCase() === 'svg' || el.querySelector?.(':scope > svg')) o.bevatSvg = true;
    const doorvoer = isDoorvoer(el, cs);
    if (doorvoer) o.doorvoer = true;
    if (diepte < 8) {
      const kids = [...el.children].filter(k => {
        const c2 = getComputedStyle(k);
        return c2.display !== 'none' && c2.visibility !== 'hidden';
      });
      // Een doorvoer-wrapper kost geen diepte: het budget is bedoeld voor ontwerplagen,
      // niet voor de <View>-stapel die RN eromheen zet.
      if (kids.length) o.kinderen = kids.map(k => lees(k, doorvoer ? diepte : diepte + 1, r));
    }
    // Een absoluut gepositioneerd kind valt buiten de box van zijn ouder, dus een overlay-
    // wortel meet 0 breed of 0 hoog terwijl er wél iets staat. Gemeten 2026-09-07: tien
    // variant-nodes kwamen zo op 0x0 in Figma (BottomSheet, GoalSheet, HealthConsentScreen,
    // MotivationalToast, DeviceSelectionModal, alle vier de WheelPickers). Herstel de box
    // uit de vereniging van de kinderen — en markeer dat, want een herstelde maat is een
    // afleiding en geen meting.
    if (o.w < 2 || o.h < 2) {
      // Vereniging van ALLE afstammelingen, niet alleen de directe kinderen: bij WheelPicker
      // zit de zichtbare inhoud twee niveaus diep, en een unie over de directe kinderen
      // maakte de box juist kleiner (0x250 -> 2x60, gemeten). En alleen toepassen als het
      // resultaat GROTER is — een herstel dat krimpt is geen herstel.
      const boxen = [...el.querySelectorAll('*')].map(k => k.getBoundingClientRect())
        .filter(b => b.width > 0 && b.height > 0);
      if (boxen.length) {
        const l = Math.min(...boxen.map(b => b.left)), r2 = Math.max(...boxen.map(b => b.right));
        const t = Math.min(...boxen.map(b => b.top)), bo = Math.max(...boxen.map(b => b.bottom));
        // PER AS, en geklemd op het viewport. Twee redenen, allebei gemeten 2026-09-07:
        //  · WheelPicker is 0 breed maar wél 250 hoog; beide assen vervangen maakte hem
        //    97x4191 — de volledige scrollhoogte in plaats van het zichtbare venster.
        //  · Een sheet met een scrollgebied gaf 430x25100 om dezelfde reden (GoalSheet).
        // Een component is nooit groter dan het scherm waarop hij staat, dus het viewport
        // is de bovengrens. Alleen de as die 0 was wordt vervangen.
        const nw = Math.min(Math.round((r2 - l) * 100) / 100, window.innerWidth);
        const nh = Math.min(Math.round((bo - t) * 100) / 100, window.innerHeight);
        const was = [o.w, o.h];
        if (o.w < 2 && nw >= 2) o.w = nw;
        if (o.h < 2 && nh >= 2) o.h = nh;
        if (o.w !== was[0] || o.h !== was[1]) o.herstelde = { was };
      }
    }
    return o;
  }
  // De overlays krijgen `abs` mee: ze liggen in de DOM over het viewport, en de builder legt
  // ze zo als absoluut gepositioneerd kind naast de schermboom in plaats van eronder in de
  // auto-layout-stroom.
  const boom = lees(kinderen[0], 0, null);
  const overlayBomen = overlays.map(el => {
    const o = lees(el, 0, null);
    o.positie = 'absolute'; o.dx = 0; o.dy = 0;
    return o;
  });
  return overlayBomen.length ? { boom, overlays: overlayBomen } : { boom };
};

// ---------------------------------------------------------------------------
// Doorloop
// ---------------------------------------------------------------------------
const spec = { componenten: {}, schermen: {}, ongebonden: [], fouten: [] };

/**
 * Een absoluut gepositioneerd kind erft een ontbrekende maat van zijn ouder.
 *
 * WAAROM. `position: absolute` met `left:0; right:0` krijgt zijn breedte van de ouder. Was
 * die ouder op meetmoment zelf 0 breed (de overlay-wortels), dan meet het kind óók 0 — en
 * de wortel-herstelstap die daarna draait raakt het kind niet. Gemeten 2026-09-07: de acht
 * fade-verlopen in WheelPicker kwamen zo op 0,01 px breed in Figma terecht. De vulling stond
 * er, hij was alleen onzichtbaar — precies de vorm die een groene bouw verbergt.
 *
 * Alleen de as die 0 is wordt overgenomen, en alleen van een ouder die er zelf wél een heeft.
 */
function erfMaatVanOuder(node, ouder) {
  if (ouder && node.positie === 'absolute') {
    if (node.w < 2 && ouder.w >= 2) { node.geerfd = { ...(node.geerfd ?? {}), w: node.w }; node.w = ouder.w; }
    if (node.h < 2 && ouder.h >= 2) { node.geerfd = { ...(node.geerfd ?? {}), h: node.h }; node.h = ouder.h; }
  }
  for (const k of node.kinderen ?? []) erfMaatVanOuder(k, node);
}

async function meet(storyId, args) {
  const q = (Object.keys(args).length ? `&args=${encodeURIComponent(argsQuery(args))}` : '')
    // --rnw-keys-uit is de NEGATIEVE CONTROLE van de sleutelkaart. Zonder hem is "elke node
    // heet wrapper" niet te onderscheiden van "het instrument staat uit": beide geven een
    // gevulde spec zonder foutmelding. Met de vlag hoort de walker hard te falen.
    + (process.argv.includes('--rnw-keys-uit') ? '&rnwKeysUit=1' : '');
  await page.goto(`http://localhost:${poort}/iframe.html?id=${storyId}&viewMode=story${q}`,
    { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(120);
  const r = await page.evaluate(WALKER);
  if (r.boom) erfMaatVanOuder(r.boom, null);
  for (const o of r.overlays ?? []) erfMaatVanOuder(o, null);
  // De args van deze story, uit Storybook's eigen preview-API. Die geven de WAARDE van elke
  // prop ('Start training'), en daarmee is de slot-koppeling meetbaar in plaats van geraden:
  // de tekstnode met exact die inhoud is de doelnode.
  r.args = await page.evaluate(async (id) => {
    try { const ctx = await window.__STORYBOOK_PREVIEW__?.loadStory?.({ storyId: id }); return ctx?.initialArgs ?? null; }
    catch (e) { return null; }
  }, storyId);
  return r;
}

/**
 * Markeert per component welke tekstnode aan welke prop hangt — het slot.
 *
 * De regel is dezelfde als bij de tokenmatching: koppel alleen wat ONDUBBELZINNIG is. Komt de
 * waarde van een prop niet precies één keer als tekstnode voor, dan is de koppeling
 * dubbelzinnig en wordt ze gemeld in plaats van gegokt. Een variant-as doet niet mee — die
 * wordt al door de variant-properties uitgedrukt.
 */
function markeerSlots(comp, items, assen, fouten) {
  const asNamen = new Set(Object.keys(assen ?? {}));
  const gevonden = new Set();
  for (const it of items) {
    const args = it.args ?? {};
    for (const [prop, waarde] of Object.entries(args)) {
      if (asNamen.has(prop) || typeof waarde !== 'string' || !waarde.trim()) continue;
      const treffers = [];
      (function loop(n) {
        if (n.tekst && n.tekst.inhoud === waarde) treffers.push(n);
        for (const k of n.kinderen ?? []) loop(k);
      })(it.boom);
      if (treffers.length === 1) { treffers[0].slot = prop; gevonden.add(prop); }
      else if (treffers.length > 1) fouten.push(`${comp} [${it.naam}]: prop "${prop}" komt ${treffers.length}x voor als tekst — dubbelzinnig, geen slot`);
      // 0 treffers is normaal: een variant kan de prop niet tonen (loading, of een icoon-only knop).
    }
  }
  return [...gevonden];
}

/**
 * Nodes die per render ANDERS zijn en dus geen stabiel Figma-artefact kunnen zijn.
 *
 * MotivationalToast tekent 60 confettideeltjes met `size: 6 + Math.random() * 8`, dus
 * radius = size/2 levert 60 gebroken waarden op die bij elke render verschillen. Die als
 * 60 tokengaten rapporteren is ruis: het is één ontwerpbeslissing (gerandomiseerde
 * decoratie), geen zestig ontbrekende tokens. Ze worden geteld als decoratief en niet
 * als gat — expliciet, want stil weglaten ziet er identiek uit als "geen probleem".
 *
 * De toets is de VORM, niet de storynaam. Tot 2026-09-08 stond hier
 * `comp === 'MotivationalToast'`, en dat brak zodra de toast óók als overlay binnen
 * ActivePhase gemeten werd: `comp` was daar `'ActivePhase'`, de filter zweeg, en de
 * [binding]-as sprong van 46 naar 109 ongebonden waarden — hot pink, goud, en radii als
 * 3,2993. Een componentnaam als filtersleutel beschrijft twee dingen tegelijk (welke story
 * render ik / bij welk component hoort deze node) en is dus geen sleutel.
 *
 * De handtekening is gemeten, niet bedacht: van alle 120 nodes met een gebroken radius in
 * de hele spec is er GEEN ENKELE die niet vierkant, kinderloos, tekstloos en kleiner dan
 * 20 px is. Overmatchen kan dus niet — er is niets anders om te matchen.
 */
const decoratief = (comp, node) =>
  node.radius?.[0] > 0 && !Number.isInteger(node.radius[0])
  && !(node.kinderen ?? []).length && !node.tekst
  && Math.abs(node.w - node.h) < 0.01 && node.w < 20;

/** Voegt variabele-verwijzingen toe aan een gemeten boom, per eigenschapssoort. */
function bind(node, pad, comp) {
  if (decoratief(comp, node)) {
    node.decoratief = 'gerandomiseerde confetti (size = 6 + random*8) — geen stabiel artefact';
    spec.decoratief = (spec.decoratief ?? 0) + 1;
    for (const k of node.kinderen ?? []) bind(k, pad + '>d', comp);
    return;
  }
  const meld = (wat, waarde) => spec.ongebonden.push(`${comp} ${pad}: ${wat} = ${waarde}`);
  if (node.bg && node.bg.a > 0) {
    node.bgVar = kiesKleur(node.bg, comp);
    if (!node.bgVar) meld('achtergrond', JSON.stringify(node.bg));
  }
  if (node.borderColor && node.borderWidth > 0) {
    node.borderColorVar = kiesKleur(node.borderColor, comp);
    if (!node.borderColorVar) meld('randkleur', JSON.stringify(node.borderColor));
    node.borderWidthVar = kiesGetal('breedte', node.borderWidth, comp);
    if (!node.borderWidthVar) meld('randbreedte', node.borderWidth);
  }
  node.radiusVar = node.radius.every(r => r === node.radius[0]) && node.radius[0] > 0
    ? kiesGetal('radius', node.radius[0], comp) : null;
  if (node.radius[0] > 0 && !node.radiusVar) meld('radius', node.radius[0]);
  node.paddingVar = node.padding.map(p => p === 0 ? null : kiesGetal('spacing', p, comp));
  node.padding.forEach((p, i) => { if (p > 0 && !node.paddingVar[i]) meld('padding', p); });
  node.gapVar = node.gap ? kiesGetal('spacing', node.gap, comp) : null;
  if (node.gap > 0 && !node.gapVar) meld('gap', node.gap);
  // Gradients: CSS-string -> stops met hun eigen binding. Alle vijf de vormen in deze
  // codebase zijn tweestops-lineair (gemeten), vier verticaal en één op 90deg.
  if (node.backgroundImage?.includes('linear-gradient')) {
    const g = ontleedGradient(node.backgroundImage);
    if (!g) meld('gradient', node.backgroundImage.slice(0, 60));
    else {
      node.gradientStops = g.stops.map((st, i) => ({
        positie: g.stops.length === 1 ? 0 : i / (g.stops.length - 1),
        kleur: st, kleurVar: kiesKleur(st, comp),
      }));
      node.gradientHoek = g.hoek;
      for (const st of node.gradientStops) if (!st.kleurVar) meld('gradientstop', JSON.stringify(st.kleur));
    }
  }
  if (node.tekst) {
    node.tekst.kleurVar = kiesKleur(node.tekst.kleur, comp);
    if (!node.tekst.kleurVar) meld('tekstkleur', JSON.stringify(node.tekst.kleur));
    const kandidaten = payload.textStyles.filter(t =>
      t.expoVariant === node.tekst.family && t.fontSize === node.tekst.size);
    node.tekst.styleRef = kandidaten.length === 1 ? kandidaten[0].naam
      : (kandidaten.find(t => Math.abs((t.letterSpacingPx ?? 0) - node.tekst.letterSpacing) < 0.02)?.naam ?? null);
    if (!node.tekst.styleRef) meld('text style', `${node.tekst.family} ${node.tekst.size}px ls=${node.tekst.letterSpacing}`);
  }
  for (const k of node.kinderen ?? []) bind(k, pad + '>' + (node.kinderen.indexOf(k)), comp);
}

spec.uitgesloten = [];
for (const [comp, d] of Object.entries(assen.componenten)) {
  if (SCHERMEN[comp]) continue;
  const gebruikteAssen = {};
  for (const [as, waarden] of Object.entries(d.assen)) {
    const sleutel = `${comp}.${as}`;
    if (NIET_VISUEEL[sleutel]) { spec.uitgesloten.push(`${sleutel} — ${NIET_VISUEEL[sleutel]}`); continue; }
    gebruikteAssen[as] = waarden;
  }
  d.assen = gebruikteAssen;
  const combis = combinaties(d.assen);
  const varianten = [];
  for (const c of combis) {
    const r = await meet(d.storyId, c.args);
    if (r.fout) { spec.fouten.push(`${comp} [${c.naam}]: ${r.fout}`); continue; }
    bind(r.boom, '', comp);
    r.overlays?.forEach((o, i) => bind(o, `overlay${i}`, comp));
    varianten.push({ naam: c.naam, args: c.args, boom: r.boom, overlays: r.overlays, storyArgs: r.args });
  }
  (spec.naamStats ??= []).push(...benoemAlles(comp, varianten));   // laagnamen: één beslissing per component
  const slots = markeerSlots(comp, varianten.map(v => ({ naam: v.naam, boom: v.boom, args: v.storyArgs })), d.assen, spec.fouten);
  spec.componenten[comp] = { storyId: d.storyId, assen: d.assen, slots, varianten };
  process.stderr.write(`  ${comp}: ${varianten.length}/${combis.length}\n`);
}

// Schermen: de benoemde stories, geen assen.
const index = JSON.parse(readFileSync(join(STATIC, 'index.json'), 'utf8'));
for (const [comp, storyNamen] of Object.entries(SCHERMEN)) {
  const frames = [];
  for (const naam of storyNamen) {
    const e = Object.values(index.entries).find(x => x.title === `Componenten/${comp}` && x.name === naam);
    if (!e) { spec.fouten.push(`${comp}: story "${naam}" bestaat niet`); continue; }
    const r = await meet(e.id, {});
    if (r.fout) { spec.fouten.push(`${comp} [${naam}]: ${r.fout}`); continue; }
    bind(r.boom, '', comp);
    r.overlays?.forEach((o, i) => bind(o, `overlay${i}`, comp));
    frames.push({ naam, storyId: e.id, boom: r.boom, overlays: r.overlays });
  }
  (spec.naamStats ??= []).push(...benoemAlles(comp, frames));
  spec.schermen[comp] = { frames, afgeschrevenAssen: assen.componenten[comp].assen };
  process.stderr.write(`  ${comp} (scherm): ${frames.length}/${storyNamen.length}\n`);
}

await browser.close(); server.close();

// ---- Poort vóór het schrijven ----------------------------------------------------------
// Deze stap SCHRIJFT: figma/build-spec.json is de invoer van de builder én van de guard. Een
// mislukte meting die tóch wegschrijft, vervangt een goede spec door een lege — en exit 0
// maakt dat onzichtbaar. Gemeten 2026-09-08: de negatieve controle (`--rnw-keys-uit`) liet
// alle 33 componenten op 0 varianten uitkomen en het script overschreef vrolijk de goede
// spec met exit 0. Een component zonder enkele variant is per definitie een meetfout, nooit
// een geldige uitkomst.
const leeg = [
  ...Object.entries(spec.componenten).filter(([, d]) => !d.varianten.length).map(([c]) => c),
  ...Object.entries(spec.schermen).filter(([, d]) => !d.frames.length).map(([c]) => c),
];
if (leeg.length) {
  console.error(`\nGEEN SPEC GESCHREVEN — ${leeg.length} component(en) leverden nul varianten: ${leeg.slice(0, 8).join(', ')}${leeg.length > 8 ? ', …' : ''}`);
  console.error(`Eerste fouten:\n  ${spec.fouten.slice(0, 3).join('\n  ')}`);
  console.error('figma/build-spec.json is ONGEWIJZIGD gelaten.');
  process.exit(2);
}

writeFileSync(join(APP, 'figma/build-spec.json'), JSON.stringify(spec, null, 1));
const nVar = Object.values(spec.componenten).reduce((n, c) => n + c.varianten.length, 0);
console.log(`\ncomponent sets : ${Object.keys(spec.componenten).length}  (${nVar} variant-nodes)`);
console.log(`schermen       : ${Object.keys(spec.schermen).length}  (${Object.values(spec.schermen).reduce((n,s)=>n+s.frames.length,0)} frames)`);
console.log(`uitgesloten    : ${spec.uitgesloten.length} as(sen)`);
for (const u of spec.uitgesloten) console.log('   -- ' + u);
console.log(`decoratief     : ${spec.decoratief ?? 0} nodes (gerandomiseerd, niet als gat geteld)`);
console.log(`ongebonden     : ${spec.ongebonden.length}`);
console.log(`fouten         : ${spec.fouten.length}`);
for (const f of spec.fouten.slice(0, 20)) console.log('  FOUT ' + f);
const uniek = [...new Set(spec.ongebonden.map(o => o.split(': ')[1]))];
for (const o of uniek.slice(0, 25)) console.log('  ONGEBONDEN ' + o);
if (uniek.length > 25) console.log(`  ... en ${uniek.length - 25} andere unieke ongebonden waarden`);
