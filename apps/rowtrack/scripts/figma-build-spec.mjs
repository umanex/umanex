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
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = join(APP, 'storybook-static');
const assen = JSON.parse(readFileSync(join(APP, 'figma/story-axes.json'), 'utf8'));
const payload = JSON.parse(readFileSync(join(APP, 'figma/tokens-payload.json'), 'utf8'));

// Componenten die als SCHERM gemodelleerd worden: representatieve frames in plaats van een
// component set. Besluit Jeroen 2026-09-07 — hun assen zijn statusenums die in beeld niet
// orthogonaal zijn (bij bleStatus='error' ziet hrStatus er in de meeste combinaties identiek
// uit), en de productregel zou 320 respectievelijk 160 nodes eisen voor twee schermen.
const SCHERMEN = {
  ActivePhase: ['Playground', 'Doel Afstand', 'Zonder Hartslagband', 'Doel Bereikt', 'Samenvatting'],
  IdlePhase: ['Playground', 'Niet Verbonden', 'Doel Afstand', 'Toestel Keuze'],
};

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
const VOLGORDE = ['Component', 'Theme', 'Core'];
const platteWaarde = new Map();   // 'COLOR|rgba' of 'FLOAT|12' -> 'Set:naam'
{
  // Los aliassen op tot hun letterlijke waarde, zodat ook een alias matcht.
  const perSet = {};
  for (const [set, c] of Object.entries(payload.collecties)) {
    perSet[set] = new Map(c.variabelen.map(v => [v.naam, v]));
  }
  const los = (set, naam, d = 0) => {
    if (d > 12) return null;
    const v = perSet[set]?.get(naam);
    if (!v) return null;
    if (v.alias) return los(v.alias.set, v.alias.naam, d + 1);
    return v;
  };
  for (const set of VOLGORDE) {
    for (const v of payload.collecties[set].variabelen) {
      const w = los(set, v.naam);
      if (!w) continue;
      let sleutel = null;
      if (w.type === 'COLOR') {
        const c = w.waarde;
        sleutel = `COLOR|${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${Math.round((c.a??1)*1000)/1000}`;
      } else if (w.type === 'FLOAT') sleutel = `FLOAT|${w.waarde}`;
      if (sleutel && !platteWaarde.has(sleutel)) platteWaarde.set(sleutel, `${set}:${v.naam}`);
    }
  }
}
const varVoorKleur = (r, g, b, a) => platteWaarde.get(`COLOR|${r},${g},${b},${Math.round(a*1000)/1000}`) ?? null;
const varVoorGetal = (n) => platteWaarde.get(`FLOAT|${n}`) ?? null;

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
const argsQuery = args => Object.entries(args)
  .map(([k, v]) => `${k}:${typeof v === 'boolean' ? '!' + v : v}`).join(';');

// De DOM-walker draait in de pagina. Hij levert een boom met rauwe waarden; het mappen naar
// variabelen gebeurt in Node, zodat de tokenkennis op één plek staat.
const WALKER = () => {
  const root = document.querySelector('#storybook-root');
  const decorator = root?.firstElementChild;
  if (!decorator) return { fout: 'geen decorator' };
  let kinderen = [...decorator.children];

  // Een <Modal> portaleert in react-native-web BUITEN #storybook-root, naar document.body.
  // Gemeten 2026-09-07: MotivationalToast en DeviceSelectionModal gaven dan "0 kinderen"
  // terwijl ze prima renderden. Zonder deze tak zou een overlay-component stil als leeg
  // gelezen worden — dezelfde vorm als een echte lege render.
  if (kinderen.length === 0) {
    // Anker op INHOUD, niet op afmeting: de portal-wortel heeft hoogte 0 omdat de modal
    // erin absoluut gepositioneerd is. Een filter op `height > 0` sneed hem precies weg
    // (gemeten 2026-09-07 — eerste poging vond nul portals terwijl er één stond).
    // Storybook's eigen wrappers dragen een id of een sb-class; de portal geen van beide.
    const buiten = [...document.body.children].filter(el =>
      el.tagName !== 'SCRIPT' && el.tagName !== 'SVG' && el.tagName !== 'svg' &&
      !el.id && !/\bsb-/.test(String(el.className || '')) &&
      !el.contains(root) && (el.textContent || '').trim().length > 0);
    if (buiten.length === 1) kinderen = [buiten[0]];
    else if (buiten.length > 1) return { fout: `${buiten.length} portal-wortels buiten #storybook-root` };
  }
  if (kinderen.length !== 1) return { fout: `verwacht 1 kind onder de decorator, kreeg ${kinderen.length}` };

  const px = v => { const n = parseFloat(v); return Number.isNaN(n) ? 0 : n; };
  const rgba = v => {
    const m = String(v).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const d = m[1].split(',').map(x => parseFloat(x.trim()));
    return { r: d[0], g: d[1], b: d[2], a: d[3] ?? 1 };
  };
  function lees(el, diepte) {
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
    if (el.tagName.toLowerCase() === 'svg' || el.querySelector?.(':scope > svg')) o.bevatSvg = true;
    if (diepte < 6) {
      const kids = [...el.children].filter(k => {
        const c2 = getComputedStyle(k);
        return c2.display !== 'none' && c2.visibility !== 'hidden';
      });
      if (kids.length) o.kinderen = kids.map(k => lees(k, diepte + 1));
    }
    return o;
  }
  return { boom: lees(kinderen[0], 0) };
};

// ---------------------------------------------------------------------------
// Doorloop
// ---------------------------------------------------------------------------
const spec = { componenten: {}, schermen: {}, ongebonden: [], fouten: [] };

async function meet(storyId, args) {
  const q = Object.keys(args).length ? `&args=${encodeURIComponent(argsQuery(args))}` : '';
  await page.goto(`http://localhost:${poort}/iframe.html?id=${storyId}&viewMode=story${q}`,
    { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(120);
  return page.evaluate(WALKER);
}

/** Voegt variabele-verwijzingen toe aan een gemeten boom. */
function bind(node, pad, comp) {
  const meld = (wat, waarde) => spec.ongebonden.push(`${comp} ${pad}: ${wat} = ${waarde}`);
  if (node.bg && node.bg.a > 0) {
    node.bgVar = varVoorKleur(node.bg.r, node.bg.g, node.bg.b, node.bg.a);
    if (!node.bgVar) meld('achtergrond', JSON.stringify(node.bg));
  }
  if (node.borderColor && node.borderWidth > 0) {
    node.borderColorVar = varVoorKleur(node.borderColor.r, node.borderColor.g, node.borderColor.b, node.borderColor.a);
    if (!node.borderColorVar) meld('randkleur', JSON.stringify(node.borderColor));
    node.borderWidthVar = varVoorGetal(node.borderWidth);
  }
  node.radiusVar = node.radius.every(r => r === node.radius[0]) ? varVoorGetal(node.radius[0]) : null;
  node.paddingVar = node.padding.map(varVoorGetal);
  node.gapVar = node.gap ? varVoorGetal(node.gap) : null;
  if (node.tekst) {
    node.tekst.kleurVar = varVoorKleur(node.tekst.kleur.r, node.tekst.kleur.g, node.tekst.kleur.b, node.tekst.kleur.a);
    if (!node.tekst.kleurVar) meld('tekstkleur', JSON.stringify(node.tekst.kleur));
    // Welke text style hoort hierbij? Match op family + size + letterSpacing-px.
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
    varianten.push({ naam: c.naam, args: c.args, boom: r.boom });
  }
  spec.componenten[comp] = { storyId: d.storyId, assen: d.assen, varianten };
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
    frames.push({ naam, storyId: e.id, boom: r.boom });
  }
  spec.schermen[comp] = { frames, afgeschrevenAssen: assen.componenten[comp].assen };
  process.stderr.write(`  ${comp} (scherm): ${frames.length}/${storyNamen.length}\n`);
}

await browser.close(); server.close();

writeFileSync(join(APP, 'figma/build-spec.json'), JSON.stringify(spec, null, 1));
const nVar = Object.values(spec.componenten).reduce((n, c) => n + c.varianten.length, 0);
console.log(`\ncomponent sets : ${Object.keys(spec.componenten).length}  (${nVar} variant-nodes)`);
console.log(`schermen       : ${Object.keys(spec.schermen).length}  (${Object.values(spec.schermen).reduce((n,s)=>n+s.frames.length,0)} frames)`);
console.log(`uitgesloten    : ${spec.uitgesloten.length} as(sen)`);
for (const u of spec.uitgesloten) console.log('   -- ' + u);
console.log(`ongebonden     : ${spec.ongebonden.length}`);
console.log(`fouten         : ${spec.fouten.length}`);
for (const f of spec.fouten.slice(0, 20)) console.log('  FOUT ' + f);
const uniek = [...new Set(spec.ongebonden.map(o => o.split(': ')[1]))];
for (const o of uniek.slice(0, 25)) console.log('  ONGEBONDEN ' + o);
if (uniek.length > 25) console.log(`  ... en ${uniek.length - 25} andere unieke ongebonden waarden`);
