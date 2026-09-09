#!/usr/bin/env node
/**
 * Serveert `apps/rowtrack/figma/` op een poort die de Figma-plugin mág bereiken.
 *
 * WAAROM. De plugin-sandbox mag `fetch` doen naar localhost, maar alleen op de poorten uit
 * `~/.figma-console-mcp/plugin/manifest.json` -> `networkAccess.allowedDomains` (9223–9232).
 * Daarbuiten krijg je `Failed to fetch` — exact dezelfde melding als bij een server die niet
 * draait, wat op 2026-09-07 tot de verkeerde conclusie leidde dat de sandbox localhost niet
 * kon bereiken.
 *
 * WAARVOOR. Zonder deze route moet elk stuk code dat in de plugin draait door de tool-call
 * zelf — de builder is 12 KB, de migratie 14 KB, de bouwspec megabytes. Met deze route is de
 * aanroep drie regels:
 *
 *     const bron = await (await fetch('http://localhost:<poort>/library-migratie.js')).text();
 *     const F = Object.getPrototypeOf(async function () {}).constructor;
 *     return await (new F('figma', bron))(figma);
 *
 * Een POST naar `/<naam>` schrijft het lichaam weg in `figma/` — zo komt een manifest of een
 * meting terug op schijf zonder door de tool-call te reizen.
 *
 * De poort wordt gekozen uit het toegestane bereik: de Bridge zelf zit op 9223 en elke extra
 * MCP-instantie pakt de volgende. Vandaar het zoeken in plaats van een vast getal.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'figma');
const POORTEN = [9229, 9230, 9232, 9228, 9227, 9231, 9226, 9225, 9224];

/** Houd elk pad binnen figma/ — een server die een repo serveert is een leesbaar filesystem. */
function veilig(p) {
  const vol = normalize(join(DIR, p));
  return vol.startsWith(DIR) ? vol : null;
}

const server = createServer((req, rep) => {
  const u = new URL(req.url, 'http://x');
  rep.setHeader('Access-Control-Allow-Origin', '*');
  const pad = veilig(decodeURIComponent(u.pathname.slice(1)));
  if (!pad) { rep.writeHead(403); return rep.end('buiten figma/'); }

  if (req.method === 'POST') {
    // BINAIR-VEILIG. Tot 2026-09-09 stond hier `body += c`, en dat maakt van elke chunk een
    // string — voor JSON onzichtbaar, voor een PNG dodelijk. De beeld-as stuurt PNG's door,
    // dus de bytes moeten heel blijven. Een `.png`-pad komt binnen als base64: de plugin-fetch
    // draagt geen binaire body gegarandeerd, tekst wél, en 33% inflatie is goedkoper dan een
    // stil corrupt beeld.
    const stukken = [];
    req.on('data', (c) => stukken.push(Buffer.from(c)));
    req.on('end', () => {
      const rauw = Buffer.concat(stukken);
      const png = pad.endsWith('.png');
      const inhoud = png ? Buffer.from(rauw.toString('utf8'), 'base64') : rauw;
      mkdirSync(dirname(pad), { recursive: true });
      writeFileSync(pad, inhoud);
      process.stdout.write(`  <- ${u.pathname} (${inhoud.length} bytes${png ? ', uit base64' : ''})\n`);
      rep.writeHead(200); rep.end(String(inhoud.length));
    });
    return;
  }
  if (!existsSync(pad) || statSync(pad).isDirectory()) { rep.writeHead(404); return rep.end('404'); }
  rep.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  rep.end(readFileSync(pad));
  process.stdout.write(`  -> ${u.pathname}\n`);
});

let i = 0;
server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE' || i >= POORTEN.length - 1) { console.error(e.message); process.exit(1); }
  server.listen(POORTEN[++i]);
});
server.listen(POORTEN[0], () =>
  console.log(`figma/ op http://localhost:${server.address().port} — binnen networkAccess.allowedDomains`));
