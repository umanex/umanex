#!/usr/bin/env node
/** Schrijft een PNG van één story uit storybook-static. Voor de beeldvergelijking met Figma. */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = join(APP, 'storybook-static');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.ttf':'font/ttf','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.map':'application/json' };
const server = createServer((q, r) => {
  let p = join(STATIC, decodeURIComponent(q.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { r.writeHead(404); return r.end('404'); }
  r.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' });
  r.end(readFileSync(p));
});
await new Promise(r => server.listen(0, r));
const poort = server.address().port;
const uitDir = join(APP, 'figma/parity-beelden');
mkdirSync(uitDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 460, height: 950 }, deviceScaleFactor: 3 });
for (const id of process.argv.slice(2)) {
  await page.goto(`http://localhost:${poort}/iframe.html?id=${id}&viewMode=story`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const el = await page.$('#storybook-root > div > *');
  const pad = join(uitDir, `${id}.png`);
  await (el ?? page).screenshot({ path: pad });
  console.log(pad);
}
await browser.close(); server.close();
