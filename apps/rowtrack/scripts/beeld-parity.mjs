#!/usr/bin/env node
/**
 * BEELD-PARITY — legt de gerenderde browser naast de gerenderde Figma-node.
 *
 * WAAROM DIT BESTAAT. `geometry-parity.mjs` vergelijkt maten en vlaggen en is daar exact in,
 * maar hij kan per constructie drie dingen NIET zien: kleurwaarde, icoonvorm en
 * `text-transform`. Die laatste is bewezen misleidend — de browser rendert "500M" waar
 * `textContent` "500m" is, over 42 nodes in 12 componenten. En op 2026-09-09 bleek het erger:
 * een `FormField`-instance stond 390 breed met een inhoud van 224, elk scherm met een
 * formulier zag er in Figma anders uit dan in de app, en dertien guard-assen stonden groen
 * met nul parity-verschillen. Breedte staat namelijk buiten parity (tekstengines meten tekst
 * anders), dus daar leefde de drift. Alleen een beeld vond het.
 *
 * WAT DIT NIET IS. Geen pixel-voor-pixel-eis. Twee renderers (Skia in Figma, Blink in
 * Chromium) hinten tekst anders, en 275 Ionicons-glyphs bestaan in Figma helemaal niet — die
 * staan er als placeholder-kader omdat het font er niet is. Een kale pixeldiff zou elke run
 * rood zijn en daarmee nutteloos. Dit script meet dus twee drempels naast elkaar (zichtbaar
 * en grof), maskeert wat structureel verschilt, en rapporteert WAAR het verschil zit in
 * plaats van alleen hoeveel.
 *
 * DE DREMPEL KIES JE ALS LAATSTE. Een tolerantie vooraf verzinnen is de klassieke manier om
 * een beeld-as onbruikbaar te maken. De volgorde is: eerst de echte verschillen wegwerken,
 * dan meten wat er aan onherleidbare renderer-ruis overblijft, en dan de drempel daarboven
 * leggen. Zonder `--drempel` rapporteert dit script alleen; hij faalt pas als je hem een
 * getal geeft.
 *
 * GEEN DEPENDENCY. Chromium decodeert de PNG's en rekent de diff op een canvas — playwright
 * staat er al voor `render-sweep`. Een extra beeldbibliotheek zou een "eerst bevestigen"-
 * actie zijn voor iets dat de browser gratis kan.
 *
 *   node scripts/beeld-parity.mjs                 # alle beelden, alleen rapporteren
 *   node scripts/beeld-parity.mjs --drempel=1.5   # faalt boven 1,5% grof verschil
 *   node scripts/beeld-parity.mjs --schrijf       # 3-luik per frame naar figma/beeld-diff/
 *   node scripts/beeld-parity.mjs --selftest      # tegenproef: rood op een mutatie, groen zonder
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = join(APP, 'storybook-static');
const BEELDEN = join(APP, 'figma/beelden');
const DIFFDIR = join(APP, 'figma/beeld-diff');
const vlag = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const SCHAAL = Number(vlag('schaal') ?? 1);
const DREMPEL = vlag('drempel') !== undefined ? Number(vlag('drempel')) : null;
const SCHRIJF = process.argv.includes('--schrijf');
const SELFTEST = process.argv.includes('--selftest');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json' };

if (!existsSync(BEELDEN) || !readdirSync(BEELDEN).length) {
  console.error(`geen beelden in figma/beelden/ — exporteer eerst uit Figma (zie apps/rowtrack/CLAUDE.md)`);
  process.exit(2);
}
if (!existsSync(join(STATIC, 'index.json'))) {
  console.error('geen storybook-static/index.json — draai eerst `pnpm --filter rowtrack build-storybook`');
  process.exit(2);
}

const index = JSON.parse(readFileSync(join(STATIC, 'index.json'), 'utf8'));
const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Van bestandsnaam naar story-id. `HistoryScreen__Een-Record.figma.png` -> de story. */
function storyVan(bestand) {
  const [comp, rest] = bestand.replace(/\.figma\.png$/, '').split('__');
  const kandidaten = Object.values(index.entries).filter((e) => e.type === 'story');
  return kandidaten.find((e) => slug(e.title.split('/').pop()) === comp && slug(e.name) === rest)
      ?? kandidaten.find((e) => slug(e.title.split('/').pop()) === comp && slug(e.name) === rest.replace(/-/g, ''));
}

const server = createServer((q, r) => {
  let p = join(STATIC, decodeURIComponent(q.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end('<!doctype html><title>leeg</title>'); }
  r.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' });
  r.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const poort = server.address().port;
const browser = await chromium.launch();

/**
 * De vergelijking zelf, in de browser. Twee drempels:
 *  · 8  — ZICHTBAAR: alles boven anti-aliasing-ruis;
 *  · 40 — GROF: een andere kleur, een ontbrekend element, verschoven layout.
 * De blokkenkaart (20x20) maakt van een percentage een plaats.
 */
async function vergelijk(page, aPng, bPng, maskers) {
  return page.evaluate(async ([a, b, mask]) => {
    const laad = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const [ia, ib] = await Promise.all([laad(a), laad(b)]);
    const W = Math.min(ia.width, ib.width), H = Math.min(ia.height, ib.height);
    const ctx = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
      return c.getContext('2d', { willReadFrequently: true }); };
    const ca = ctx(W, H), cb = ctx(W, H);
    ca.drawImage(ia, 0, 0); cb.drawImage(ib, 0, 0);
    // Maskeren gebeurt op BEIDE beelden identiek, dus een masker kan nooit een verschil maken
    // dat er niet is — hij kan er alleen een verbergen, en dat is precies de bedoeling bij
    // een glyph die in Figma niet bestaat.
    for (const m of mask) { for (const c of [ca, cb]) { c.fillStyle = '#000'; c.fillRect(m.x, m.y, m.w, m.h); } }
    const da = ca.getImageData(0, 0, W, H).data, db = cb.getImageData(0, 0, W, H).data;
    let zicht = 0, grof = 0;
    const blok = 20, cols = Math.ceil(W / blok), rows = Math.ceil(H / blok);
    const kaart = Array.from({ length: rows }, () => new Array(cols).fill(0));
    const cd = ctx(W, H); const diff = cd.createImageData(W, H);
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (d > 8) { const px = (i / 4) % W, py = Math.floor((i / 4) / W); zicht++; kaart[Math.floor(py / blok)][Math.floor(px / blok)]++; }
      if (d > 40) grof++;
      const v = d > 40 ? 255 : d > 8 ? 120 : 0;
      diff.data[i] = v; diff.data[i + 1] = v > 200 ? 0 : v; diff.data[i + 2] = 0; diff.data[i + 3] = 255;
    }
    cd.putImageData(diff, 0, 0);
    const drie = ctx(W * 3 + 24, H);
    drie.fillStyle = '#111'; drie.fillRect(0, 0, W * 3 + 24, H);
    drie.drawImage(ia, 0, 0); drie.drawImage(ib, W + 12, 0); drie.drawImage(cd.canvas, W * 2 + 24, 0);
    const heet = [];
    kaart.forEach((rij, y) => rij.forEach((n, x) => { if (n > blok * blok * 0.25) heet.push(`${x * blok},${y * blok}`); }));
    const tot = W * H;
    return { W, H, zicht: +(zicht / tot * 100).toFixed(2), grof: +(grof / tot * 100).toFixed(2),
      heet: heet.length, blokken: cols * rows, plaatsen: heet.slice(0, 6), png: drie.canvas.toDataURL('image/png') };
  }, [aPng, bPng, maskers]);
}

const dataUri = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64');

/** Rendert één story en geeft het PNG plus de rects van elke Ionicons-glyph terug. */
async function browserBeeld(page, storyId, breedte, hoogte) {
  await page.setViewportSize({ width: Math.round(breedte), height: Math.round(hoogte) });
  await page.goto(`http://localhost:${poort}/iframe.html?id=${storyId}&viewMode=story`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const el = await page.$('#storybook-root > *');
  if (!el) return null;
  const png = await el.screenshot();
  // De iconen komen uit de DOM, niet uit de spec: de spec draagt alleen relatieve posities
  // voor absolute kinderen, dus absolute rects zijn daar niet uit te rekenen.
  const iconen = await page.evaluate(() => {
    const w = document.getElementById('storybook-root').children[0].getBoundingClientRect();
    return [...document.querySelectorAll('*')]
      .filter((e) => e.children.length === 0 && getComputedStyle(e).fontFamily.toLowerCase().includes('ionicons'))
      .map((e) => { const r = e.getBoundingClientRect();
        return { x: Math.floor(r.x - w.x) - 2, y: Math.floor(r.y - w.y) - 2, w: Math.ceil(r.width) + 4, h: Math.ceil(r.height) + 4 }; });
  });
  return { png: 'data:image/png;base64,' + png.toString('base64'), iconen };
}

const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: SCHAAL });
const leegPage = await browser.newPage();
await leegPage.goto(`http://localhost:${poort}/__leeg`);

const rijen = [];
for (const bestand of readdirSync(BEELDEN).filter((f) => f.endsWith('.figma.png')).sort()) {
  const story = storyVan(bestand);
  if (!story) { rijen.push({ bestand, fout: 'geen bijpassende story' }); continue; }
  const fig = join(BEELDEN, bestand);
  const maat = await leegPage.evaluate((u) => new Promise((res) => {
    const i = new Image(); i.onload = () => res({ w: i.width, h: i.height }); i.src = u;
  }), dataUri(fig));
  const b = await browserBeeld(page, story.id, maat.w / SCHAAL, maat.h / SCHAAL);
  if (!b) { rijen.push({ bestand, fout: 'story rendert niets' }); continue; }
  const r = await vergelijk(leegPage, b.png, dataUri(fig), b.iconen);
  const { png, ...rest } = r;
  rijen.push({ bestand, story: story.id, ...rest, iconenGemaskeerd: b.iconen.length });
  if (SCHRIJF) { mkdirSync(DIFFDIR, { recursive: true });
    writeFileSync(join(DIFFDIR, bestand.replace('.figma.png', '.3luik.png')), Buffer.from(png.split(',')[1], 'base64')); }
}

if (SELFTEST) {
  // TEGENPROEF. Eén beeld tegen zichzelf hoort 0,00% te geven; hetzelfde beeld met een vlak
  // van 60x60 erover hoort ver boven nul te komen. Geven beide dezelfde uitkomst, dan meet de
  // opstelling niets — dat is de enige conclusie die dan geldig is.
  const eerste = readdirSync(BEELDEN).find((f) => f.endsWith('.figma.png'));
  const uri = dataUri(join(BEELDEN, eerste));
  const zelf = await vergelijk(leegPage, uri, uri, []);
  const gemuteerd = await leegPage.evaluate(async (u) => {
    const i = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = u; });
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const x = c.getContext('2d'); x.drawImage(i, 0, 0);
    x.fillStyle = '#00ff88'; x.fillRect(40, 40, 60, 60);
    return c.toDataURL('image/png');
  }, uri);
  const mut = await vergelijk(leegPage, uri, gemuteerd, []);
  console.log(`\nzelftest op ${eerste}`);
  console.log(`  controle (zelfde beeld) : grof ${zelf.grof}%  (hoort 0)`);
  console.log(`  mutatie  (vlak 60x60)   : grof ${mut.grof}%  (hoort > 0)`);
  const ok = zelf.grof === 0 && mut.grof > 0;
  console.log(ok ? '  ok — de opstelling wordt rood op een echte mutatie en blijft groen zonder.'
                 : '  XX — beide kanten geven hetzelfde: deze opstelling meet niets.');
  await browser.close(); server.close();
  process.exit(ok ? 0 : 1);
}

console.log(`\nbeeld-parity — ${rijen.length} beeld(en), schaal ${SCHAAL}\n`);
const breed = Math.max(...rijen.map((r) => r.bestand.length));
for (const r of rijen.sort((a, b) => (b.grof ?? 0) - (a.grof ?? 0))) {
  if (r.fout) { console.log(`  ??  ${r.bestand.padEnd(breed)}  ${r.fout}`); continue; }
  const vlag = DREMPEL !== null && r.grof > DREMPEL ? 'FAIL' : ' ok ';
  console.log(`  ${vlag} ${r.bestand.padEnd(breed)}  grof ${String(r.grof).padStart(5)}%  zichtbaar ${String(r.zicht).padStart(5)}%`
    + `  ${String(r.heet).padStart(3)}/${r.blokken} blokken  ${r.iconenGemaskeerd} icoon(en) gemaskeerd`
    + (r.plaatsen.length ? `  @ ${r.plaatsen.slice(0, 3).join(' ')}` : ''));
}
const ergst = Math.max(0, ...rijen.filter((r) => !r.fout).map((r) => r.grof));
console.log(`\nergste grof verschil: ${ergst}%` + (DREMPEL === null
  ? '  — geen drempel opgegeven, dus dit is een rapport en geen poort. Geef --drempel=<pct> zodra de vloer bekend is.'
  : `  (drempel ${DREMPEL}%)`));
writeFileSync(join(APP, 'figma/beeld-verschillen.json'), JSON.stringify({
  $comment: 'GEGENEREERD door scripts/beeld-parity.mjs. De browser naast de Figma-export, per frame.',
  gegenereerd: new Date().toISOString().slice(0, 10), schaal: SCHAAL, drempel: DREMPEL, rijen,
}, null, 1) + '\n');

await browser.close(); server.close();
process.exit(DREMPEL !== null && ergst > DREMPEL ? 1 : 0);
