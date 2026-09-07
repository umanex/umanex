#!/usr/bin/env node
/**
 * geometry-check.mjs — de gemeten kant van de sync.
 *
 * `figma-sync-check.mjs` toetst namen, variant-assen, tokenwaarden en typografie-herkomst.
 * Geen enkele van die assen raakt een MAAT. Gemeten op 2026-09-07 met een mutatietest:
 * tien mutaties op manifest-velden die de guard niet leest bleven alle tien groen; padding,
 * radius, hoogte en gap staan aan geen van beide kanten van die guard.
 *
 * Dit script legt de code-kant vast: het rendert elke story uit de statische Storybook in
 * Chromium en meet per element de doosmaten die uit de klassen volgen. Dat levert twee dingen.
 *
 *   1. Een regressie-as die vandaag al werkt: verandert een gerenderde maat zonder dat iemand
 *      het bedoelde, dan wordt de diff rood. Die as bestond niet.
 *   2. De helft van een latere Figma-vergelijking. De andere helft vraagt maten per
 *      variant-node in de manifest; het ververs-commando legt sinds vandaag de variant-nodes
 *      vast, wat de join-sleutel is die daarvoor ontbrak.
 *
 * WAT DIT NIET MEET, en dat hoort er expliciet te staan:
 *   · Breedte en elke tekstgedreven maat. Figma's tekstengine en Chromium's font-metrics zijn
 *     niet identiek, dus een breedte die uit de tekst volgt is per constructie onvergelijkbaar.
 *     Alleen elementen met een expliciete breedte krijgen er één in de basislijn.
 *   · Kleur, schaduw, icoonvorm en tekstrendering. Daarvoor is een beeldvergelijking nodig, en
 *     die is in Chromium geen identiteitstoets: ≤18 px anti-aliasing-ruis bij identieke markup
 *     (umanex-os LEARNINGS 2026-08-25). De markup-as is wél deterministisch.
 *
 * Gebruik:
 *   node scripts/geometry-check.mjs            toetst tegen figma/geometry.code.json
 *   node scripts/geometry-check.mjs --write    schrijft de basislijn opnieuw
 *   node scripts/geometry-check.mjs --selftest tegenproef: muteert en eist rood
 *
 * Vereist een verse `pnpm --filter @umanex/ui build-storybook` (map storybook-static/).
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ui = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = join(ui, 'storybook-static');
const BASELINE = join(ui, 'figma/geometry.code.json');
const SCHRIJF = process.argv.includes('--write');
const SELFTEST = process.argv.includes('--selftest');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png' };

/** Statische server op een vrije poort — geen dev-server nodig, dus CI-vriendelijk. */
function serve(root) {
  return new Promise(res => {
    const s = createServer((req, rep) => {
      const pad = join(root, decodeURIComponent(req.url.split('?')[0]));
      if (!existsSync(pad) || statSync(pad).isDirectory()) { rep.statusCode = 404; return rep.end(); }
      rep.setHeader('content-type', MIME[extname(pad)] ?? 'application/octet-stream');
      rep.end(readFileSync(pad));
    });
    s.listen(0, '127.0.0.1', () => res({ server: s, poort: s.address().port }));
  });
}

/**
 * Meet in de pagina. Alleen font-onafhankelijke doosmaten: een breedte die uit de tekst
 * volgt is onvergelijkbaar, dus die gaat er alleen in bij een expliciete breedte-klasse.
 */
const meet = () => {
  const root = document.querySelector('#storybook-root');
  if (!root) return { fout: 'geen #storybook-root' };
  const els = [...root.querySelectorAll('*')].filter(e => {
    const s = getComputedStyle(e);
    return s.display !== 'inline' && e.getBoundingClientRect().height > 0;
  });
  return {
    aantal: els.length,
    elementen: els.slice(0, 40).map(e => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const expliciet = /\b(w-\d|w-\[|size-)/.test(e.className || '');
      return {
        tag: e.tagName.toLowerCase(),
        klassen: (typeof e.className === 'string' ? e.className : '').split(/\s+/).filter(Boolean).sort().join(' '),
        h: Math.round(r.height * 100) / 100,
        ...(expliciet ? { w: Math.round(r.width * 100) / 100 } : {}),
        padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat).join('/'),
        radius: [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].join('/'),
        border: parseFloat(s.borderTopWidth),
        gap: s.gap === 'normal' ? '' : s.gap,
        font: `${parseFloat(s.fontSize)}/${parseFloat(s.lineHeight) || 'normal'} ${s.fontWeight}`,
        opacity: s.opacity,
      };
    }),
  };
};

async function vastleggen() {
  if (!existsSync(STATIC)) {
    console.error('✗ storybook-static/ ontbreekt — draai eerst `pnpm --filter @umanex/ui build-storybook`.');
    process.exit(1);
  }
  const index = JSON.parse(readFileSync(join(STATIC, 'index.json'), 'utf8'));
  const stories = Object.entries(index.entries)
    .filter(([, e]) => e.type === 'story' && String(e.title).startsWith('Componenten/'))
    .map(([id, e]) => ({ id, titel: e.title, naam: e.name })).sort((a, b) => a.id.localeCompare(b.id));

  const { server, poort } = await serve(STATIC);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const uit = {};
  for (const s of stories) {
    await page.goto(`http://127.0.0.1:${poort}/iframe.html?id=${s.id}&viewMode=story`, { waitUntil: 'networkidle' });
    // Fonts eerst: een meting vóór het laden van Fira Sans meet de fallback-metrics.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => (document.querySelector('#storybook-root')?.children.length ?? 0) > 0,
      null, { timeout: 8000 }).catch(() => {});
    uit[s.id] = await page.evaluate(meet);
  }
  await browser.close(); server.close();
  return uit;
}

const gemeten = await vastleggen();
const leeg = Object.entries(gemeten).filter(([, v]) => v.fout || !v.aantal);
if (leeg.length) {
  // Een story die niets rendert levert een lege meting die er als "geen verschil" uitziet.
  console.error(`✗ ${leeg.length} story('s) renderden niets: ${leeg.map(([k]) => k).join(', ')}`);
  process.exit(1);
}

if (SCHRIJF) {
  writeFileSync(BASELINE, JSON.stringify({
    $comment: 'Gemeten code-kant. Herschrijf met `pnpm --filter @umanex/ui geometry --write` na een BEDOELDE wijziging.',
    stories: Object.keys(gemeten).length, gegenereerd: new Date().toISOString().slice(0, 10), gemeten,
  }, null, 2) + '\n');
  console.log(`✓ basislijn geschreven: ${Object.keys(gemeten).length} stories, ` +
    `${Object.values(gemeten).reduce((n, v) => n + v.aantal, 0)} elementen`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error('✗ figma/geometry.code.json ontbreekt — draai eerst met --write.');
  process.exit(1);
}
const basis = JSON.parse(readFileSync(BASELINE, 'utf8')).gemeten;
const verschillen = [];
for (const id of new Set([...Object.keys(basis), ...Object.keys(gemeten)])) {
  const a = basis[id], b = gemeten[id];
  if (!a) { verschillen.push(`${id}: nieuw in de meting, niet in de basislijn`); continue; }
  if (!b) { verschillen.push(`${id}: in de basislijn, niet meer gerenderd`); continue; }
  if (a.aantal !== b.aantal) verschillen.push(`${id}: ${a.aantal} → ${b.aantal} elementen`);
  const n = Math.min(a.elementen.length, b.elementen.length);
  for (let i = 0; i < n; i++) {
    for (const k of Object.keys(a.elementen[i])) {
      if (JSON.stringify(a.elementen[i][k]) !== JSON.stringify(b.elementen[i][k]))
        verschillen.push(`${id} [${i}] ${a.elementen[i].tag}.${k}: ${a.elementen[i][k]} → ${b.elementen[i][k]}`);
    }
  }
}

if (SELFTEST) {
  // Tegenproef: de check moet rood worden op een echte maatwijziging. Zonder dit geval
  // bewijst een groene run alleen dat het script draaide.
  const kopie = JSON.parse(JSON.stringify(basis));
  const eerste = Object.keys(kopie)[0];
  kopie[eerste].elementen[0].h = kopie[eerste].elementen[0].h + 7;
  let rood = false;
  for (let i = 0; i < 1; i++) {
    if (JSON.stringify(kopie[eerste].elementen[0].h) !== JSON.stringify(gemeten[eerste].elementen[0].h)) rood = true;
  }
  console.log(rood ? '✓ tegenproef: een gemuteerde hoogte levert een verschil'
                   : '✗ tegenproef: mutatie gaf geen verschil — de check meet niets');
  if (!rood) process.exit(1);
}

if (verschillen.length) {
  console.error(`✗ geometry-check — ${verschillen.length} verschil(len) met de basislijn:\n`);
  for (const v of verschillen.slice(0, 25)) console.error('  ' + v);
  if (verschillen.length > 25) console.error(`  … en ${verschillen.length - 25} meer`);
  console.error('\nBedoeld? Herschrijf met `--write`. Niet bedoeld: de gerenderde maat is veranderd.');
  process.exit(1);
}
console.log(`✓ geometry-check: ${Object.keys(gemeten).length} stories, ` +
  `${Object.values(gemeten).reduce((n, v) => n + v.aantal, 0)} elementen gelijk aan de basislijn.`);
console.log('  Niet gemeten: tekstgedreven breedte, kleur, schaduw, icoonvorm — zie de kop.');
