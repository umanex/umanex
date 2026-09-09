#!/usr/bin/env node
/**
 * Rendert ELKE story uit storybook-static en meldt per story: console-fouten, pagefouten,
 * en of er werkelijk iets in #storybook-root staat.
 *
 * De lege-render-check is er omdat een geslaagde build niets zegt over gedrag: een story
 * die stil niets tekent ziet er in de build-output identiek uit aan een die klopt. Gemeten
 * 2026-09-07: de smoke-story gaf exit 0 terwijl één throw álle 33 modules blokkeerde.
 *
 * Gebruik: node scripts/render-sweep.mjs [--verbose]
 * Vereist: pnpm --filter rowtrack build-storybook
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = join(APP, 'storybook-static');
const VERBOSE = process.argv.includes('--verbose');
if (!existsSync(join(STATIC, 'index.json'))) {
  console.error('geen storybook-static/index.json — draai eerst `pnpm --filter rowtrack build-storybook`');
  process.exit(2);
}
const index = JSON.parse(readFileSync(join(STATIC, 'index.json'), 'utf8'));
const stories = Object.values(index.entries).filter(e => e.type === 'story');

const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff',
  '.ttf':'font/ttf', '.png':'image/png', '.map':'application/json' };
const server = createServer((req, rep) => {
  let p = join(STATIC, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { rep.writeHead(404); return rep.end('404'); }
  rep.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' });
  rep.end(readFileSync(p));
});
await new Promise(r => server.listen(0, r));
const poort = server.address().port;

const browser = await chromium.launch();

/**
 * ÉÉN PAGINA VOOR 257 STORIES HOUDT HET NIET, en het faalt aan de staart.
 *
 * Gemeten 2026-09-09, vijf achtereenvolgende runs op dezelfde build: 16, 0, 0, 5 en 2
 * "problemen" — hetzelfde instrument, dezelfde invoer, vijf uitkomsten. De gemelde stories
 * waren telkens de LAATSTE: 255, 256 en 257 van 257 (`ProfileScreen`), met 404's op resources
 * en een ontbrekende `#storybook-root`. Diezelfde drie stories renderen in isolatie drie keer
 * op rij foutloos, zonder één 404. Het is dus geen kapotte story maar ophoping op de
 * hergebruikte pagina: na een paar honderd navigaties begint Chromium requests te laten vallen.
 *
 * De richting van de fout is belangrijk: dit levert VALSE ALARMEN op, geen gemiste fouten —
 * een groene run blijft dus betrouwbaar, een rode vroeg om een herhaling. Dat is precies de
 * verkeerde kant om op te vertrouwen, want de gate wordt gelezen als "alles rendert".
 *
 * De remedie is de pagina periodiek verversen. 50 is ruim onder de grens waar het misging en
 * kost vijf herstarts over de hele sweep.
 */
const PER_PAGINA = 50;
let page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let sindsVers = 0;
let ververst = 0;

const resultaten = [];
for (const s of stories) {
  if (sindsVers >= PER_PAGINA) {
    await page.close();
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    sindsVers = 0; ververst++;
  }
  sindsVers++;
  const fouten = [];
  const onConsole = m => { if (m.type() === 'error') fouten.push(m.text()); };
  const onError = e => fouten.push('pageerror: ' + e.message);
  page.on('console', onConsole); page.on('pageerror', onError);
  try {
    await page.goto(`http://localhost:${poort}/iframe.html?id=${s.id}&viewMode=story`,
      { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(150);
    const vorm = await page.evaluate(() => {
      const root = document.querySelector('#storybook-root');
      if (!root) return { root: false };
      const r = root.getBoundingClientRect();
      return {
        root: true,
        nodes: root.querySelectorAll('*').length,
        tekst: (root.textContent || '').trim().length,
        oppervlak: Math.round(r.width) * Math.round(r.height),
      };
    });
    resultaten.push({ id: s.id, titel: s.title, naam: s.name, fouten, ...vorm });
  } catch (e) {
    resultaten.push({ id: s.id, titel: s.title, naam: s.name, fouten: [...fouten, 'navigatie: ' + e.message], root: false });
  }
  page.off('console', onConsole); page.off('pageerror', onError);
}
await browser.close(); server.close();
if (VERBOSE) console.log(`pagina ${ververst}x ververst (elke ${PER_PAGINA} stories)`);

const metFout = resultaten.filter(r => r.fouten.length);
// "Leeg" = geen enkele afstammeling. De preview-decorator levert er altijd minstens één,
// dus 0 nodes betekent dat de story zélf niets opleverde, niet dat hij klein is.
const leeg = resultaten.filter(r => r.root && r.nodes === 0);
const zonderRoot = resultaten.filter(r => !r.root);

console.log(`render-sweep — ${resultaten.length} stories over ${new Set(resultaten.map(r => r.titel)).size} componenten\n`);
if (metFout.length) {
  console.log(`FOUTEN in ${metFout.length} stories:`);
  for (const r of metFout) { console.log(`  ${r.id}`); for (const f of r.fouten.slice(0, 2)) console.log(`      ${f.slice(0, 180)}`); }
  console.log('');
}
if (zonderRoot.length) { console.log(`GEEN #storybook-root in ${zonderRoot.length}:`); for (const r of zonderRoot) console.log('  ' + r.id); console.log(''); }
if (leeg.length) { console.log(`LEEG gerenderd (0 nodes) in ${leeg.length}:`); for (const r of leeg) console.log('  ' + r.id); console.log(''); }
if (VERBOSE) for (const r of resultaten) console.log(`  ${String(r.nodes).padStart(4)} nodes  ${String(r.tekst).padStart(5)} tekens  ${r.id}`);

const stuk = metFout.length + zonderRoot.length + leeg.length;
console.log(stuk === 0
  ? `alle ${resultaten.length} stories renderen: geen console-fout, geen lege render.`
  : `${stuk} van ${resultaten.length} stories hebben een probleem.`);
process.exit(stuk === 0 ? 0 : 1);
