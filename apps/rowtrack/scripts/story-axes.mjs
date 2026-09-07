#!/usr/bin/env node
/**
 * Leest de variant-assen per component uit de DRAAIENDE Storybook, niet uit de TS-bron.
 *
 * WAAROM RUNTIME. `argTypes` is wat Storybook uiteindelijk oplost: een control die in de
 * story op `false` staat komt terug als `control.disable === true`, en dat onderscheid is
 * met een regex over het bronbestand niet te maken. De assen zijn de JOIN-SLEUTEL tussen
 * de Figma component set en de Playground-story; een verkeerde as hier betekent een
 * variant-node in Figma die nergens bij hoort.
 *
 * DE REGEL, één zin: een prop is een visuele as wanneer zijn control niet uitgeschakeld is
 * én hij ofwel `options` heeft (select/radio) ofwel een boolean is.
 *
 * Uitvoer: figma/story-axes.json — gelezen door de Figma-bouw én door figma-sync-check.mjs,
 * zodat beide kanten per constructie dezelfde lijst gebruiken.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = join(APP, 'storybook-static');
if (!existsSync(join(STATIC, 'index.json'))) {
  console.error('geen storybook-static — draai eerst `pnpm --filter rowtrack build-storybook`');
  process.exit(2);
}
const index = JSON.parse(readFileSync(join(STATIC, 'index.json'), 'utf8'));

// Eén story per component: de Playground. Dat is de story waarop de parity joint, dus de
// assen moeten daar vandaan komen en niet van een willekeurige named story.
const playgrounds = Object.values(index.entries)
  .filter(e => e.type === 'story' && e.name === 'Playground');
const zonderPlayground = [...new Set(Object.values(index.entries).map(e => e.title))]
  .filter(t => !playgrounds.some(p => p.title === t));

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
const page = await browser.newPage();
const uit = {};
const fouten = [];

for (const s of playgrounds) {
  await page.goto(`http://localhost:${poort}/iframe.html?id=${s.id}&viewMode=story`,
    { waitUntil: 'networkidle', timeout: 20000 });
  const data = await page.evaluate(async (storyId) => {
    const prev = window.__STORYBOOK_PREVIEW__;
    const st = await prev.storyStore.loadStory({ storyId });
    const assen = {}, uitgesloten = {};
    for (const [naam, at] of Object.entries(st.argTypes)) {
      const uitgezet = at.control === false || at.control?.disable === true;
      const heeftOpties = Array.isArray(at.options) && at.options.length > 0;
      const isBool = at.type?.name === 'boolean' || at.control?.type === 'boolean';
      if (!heeftOpties && !isBool) continue;               // geen kandidaat-as
      if (uitgezet) { uitgesloten[naam] = heeftOpties ? at.options : [true, false]; continue; }
      assen[naam] = heeftOpties ? at.options : [true, false];
    }
    return { assen, uitgesloten, initialArgs: Object.keys(st.initialArgs ?? {}) };
  }, s.id).catch(e => ({ fout: e.message }));

  if (data.fout) { fouten.push(`${s.title}: ${data.fout}`); continue; }
  const component = s.title.replace(/^Componenten\//, '');
  const aantal = Object.values(data.assen).reduce((n, w) => n * w.length, 1);
  uit[component] = { storyId: s.id, titel: s.title, assen: data.assen,
                     uitgesloten: data.uitgesloten, variantNodes: aantal };
}
await browser.close(); server.close();

const totaal = Object.values(uit).reduce((n, c) => n + c.variantNodes, 0);
const payload = {
  $comment: 'GEGENEREERD door scripts/story-axes.mjs uit de gebouwde Storybook. Niet met de hand bewerken.',
  componenten: uit, zonderPlayground, fouten, totaalVariantNodes: totaal,
};
writeFileSync(join(APP, 'figma/story-axes.json'), JSON.stringify(payload, null, 1));

console.log(`${Object.keys(uit).length} componenten met een Playground-story`);
if (zonderPlayground.length) console.log(`ZONDER Playground: ${zonderPlayground.join(', ')}`);
if (fouten.length) { console.log('FOUTEN:'); for (const f of fouten) console.log('  ' + f); }
console.log('');
for (const [c, d] of Object.entries(uit).sort((a, b) => b[1].variantNodes - a[1].variantNodes)) {
  const as = Object.entries(d.assen).map(([n, w]) => `${n}=${w.length}`).join(' × ') || '(geen as)';
  console.log(`  ${String(d.variantNodes).padStart(3)}  ${c.padEnd(24)} ${as}`);
}
console.log(`\ntotaal ${totaal} variant-nodes over ${Object.keys(uit).length} component sets`);
if (fouten.length) process.exitCode = 1;
