#!/usr/bin/env node
/** Eenmalige probe: rendert story-ids uit storybook-static en meet wat er werkelijk staat. */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = join(APP, 'storybook-static');
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
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const fouten = [];
page.on('console', m => { if (m.type() === 'error') fouten.push(m.text()); });
page.on('pageerror', e => fouten.push('pageerror: ' + e.message));

const id = process.argv[2] ?? 'componenten-button--playground';
await page.goto(`http://localhost:${port}/iframe.html?id=${id}&viewMode=story&dump=${process.env.DUMP ?? 400}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// Forceer alle families te laden: document.fonts.check() is false voor een font dat
// deze story niet gebruikt — dat meet de story, niet de @font-face-laag.
const FAMILIES = ['AlbertSans_400Regular','SourceSerif4_400Regular','BarlowCondensed_700Bold','JetBrainsMono_400Regular'];
await page.evaluate(f => Promise.all(f.map(n => document.fonts.load(`16px "${n}"`))), FAMILIES);

const uit = await page.evaluate((FAMILIES) => {
  const root = document.querySelector('#storybook-root');
  const knoppen = root ? root.querySelectorAll('[role="button"]') : [];
  const btn = knoppen.length === 1 ? knoppen[0] : null;
  const cs = btn ? getComputedStyle(btn) : null;
  // Anker op INHOUD, niet op tag: de tekstnode is de enige afstammeling met eigen tekst.
  const kandidaten = btn ? [...btn.querySelectorAll('*')].filter(
    e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) : [];
  const tekst = kandidaten.length === 1 ? kandidaten[0] : null;
  const ts = tekst ? getComputedStyle(tekst) : null;
  return {
    gevondenKnoppen: knoppen.length,
    gevondenTekstnodes: kandidaten.length,
    rootHtml: root ? root.innerHTML.slice(0, +(new URLSearchParams(location.search).get('dump') || 400)) : null,
    knop: cs && { hoogte: btn.getBoundingClientRect().height, breedte: Math.round(btn.getBoundingClientRect().width),
      radius: cs.borderRadius, bg: cs.backgroundColor, borderWidth: cs.borderWidth, borderColor: cs.borderColor,
      paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight, gap: cs.gap, boxShadow: cs.boxShadow.slice(0, 80) },
    tekst: ts && { inhoud: tekst.textContent, fontFamily: ts.fontFamily, fontSize: ts.fontSize,
      lineHeight: ts.lineHeight, letterSpacing: ts.letterSpacing, color: ts.color,
      knipt: tekst.scrollWidth > tekst.clientWidth },
    fontsGeladen: FAMILIES.map(f => [f, document.fonts.check(`16px "${f}"`)]),
  };
}, FAMILIES);
console.log(JSON.stringify({ story: id, consoleFouten: fouten, ...uit }, null, 2));
await browser.close(); server.close();
