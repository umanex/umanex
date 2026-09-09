#!/usr/bin/env node
/**
 * WALKER-BLINDVLEKKEN — telt in de gebouwde Storybook wat `figma-build-spec.mjs` per
 * constructie NIET meet, zodat elk van die klassen een getal heeft in plaats van een vermoeden.
 *
 * WAAROM DIT BESTAAT. De beeldvergelijking van 2026-09-09 vond vijf klassen verschillen die
 * geen enkele guard-as kon zien, en die alle vijf één oorzaak delen: de walker leest een
 * eigenschap niet, dus de builder kan hem niet bouwen, dus parity (die op dezelfde meting
 * rust) kan hem niet missen. Een lege meting is daar niet te onderscheiden van "geen
 * probleem". Dit script leest de DOM rechtstreeks, buiten de walker om, en is daarmee de
 * positieve controle: staat hier een getal, dan is het gat echt.
 *
 *   randkleur    — een node met VERSCHILLENDE KLEUREN op zijn gezette zijden. Figma's
 *                  `strokes` is één verfarray voor de hele node, dus dat is er niet in uit te
 *                  drukken; de builder zet de eerste kleur en meldt het.
 *                  Hier stond tot 2026-09-09 `rand` — randen met verschillende BREEDTES per
 *                  zijde — met 110 treffers. Die zijn geen blinde vlek meer: de walker meet
 *                  sinds die dag alle vier de zijden en de builder zet `strokeTopWeight` c.s.
 *                  Een teller die een gedicht gat blijft tellen, is een vals alarm; wat er
 *                  van dat gat OVER is, is de kleur. Gemeten over alle 257 stories: 333 nodes
 *                  met rand, 138 asymmetrisch in twee vormen (99x `0/0/1/0`, 39x `1/0/1/0`),
 *                  en **0** met meer dan één kleur. Dit is dus een wachtpost op nul, en dat
 *                  hoort erbij te staan — anders is "nul" straks niet te onderscheiden van
 *                  een teller die niets meet.
 *   placeholder  — `<input placeholder>` zonder waarde; een attribuut, geen tekstnode, dus
 *                  het veld staat leeg in Figma
 *   gescrold     — containers met `scrollTop > 0`; de walker meet geen scrollpositie, dus de
 *                  WheelPicker toont zijn lijst vanaf item 1
 *   overloop     — inhoud hoger dan de container zonder `overflow` die knipt; de builder zet
 *                  `clipsContent = false`, dus de lijst loopt onder de knop door
 *   inline       — een element met eigen tekst én een kind met tekst (geneste `<Text>`); de
 *                  builder maakt er een frame met een los label van, zonder inline-stroom
 *   center/right — tekst met `textAlign` center of right; sinds 2026-09-09 reist dit mee
 *                  (`t.al`), het getal hier is de referentie waar de spec tegen te tellen is
 *   marge        — een niet-nul CSS-marge; Figma's auto-layout kent geen per-kind marge, dus
 *                  die ruimte verdwijnt en alles eronder schuift op. Gemeten op
 *                  WorkoutDetail/Playground: `margin-top: 28` op de tab-rij, waardoor de rij
 *                  in Figma op y=84 staat en in de browser op y=112. Zonder Figma erbij te
 *                  halen: 84+54+682+84 = 904 tegen een frame van 932
 *
 * Positieve controle (2026-09-09, 42 schermstories): randkleur 0 · placeholder 4 · gescrold 11 ·
 * overloop 15 · inline 3 · center/right 32 · marge 40. De `randkleur`-nul is gemeten en geen
 * aanname: dezelfde run telde 333 nodes MET rand, dus de selectie raakt wel degelijk nodes. Over alle 257 stories: marge 57 van
 * 13 237 nodes, verspreid over 38 stories, twaalf unieke waarden. LoginScreen/Playground
 * alleen: placeholder 1, inline 1, center/right 4.
 *
 *   node scripts/walker-blindvlekken.mjs             # totalen + voorbeelden
 *   node scripts/walker-blindvlekken.mjs --verbose   # plus een regel per story
 *   node scripts/walker-blindvlekken.mjs --alle      # alle stories, niet alleen de schermen
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = join(APP, 'storybook-static');
const VERBOSE = process.argv.includes('--verbose');
const ALLE = process.argv.includes('--alle');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json' };

if (!existsSync(join(STATIC, 'index.json'))) {
  console.error('geen storybook-static/index.json — draai eerst `pnpm --filter rowtrack build-storybook`');
  process.exit(2);
}
const index = JSON.parse(readFileSync(join(STATIC, 'index.json'), 'utf8'));
const SCHERMEN = new Set(['ActivePhase', 'IdlePhase', 'LoginScreen', 'RegisterScreen', 'ForgotPasswordScreen',
  'ResetPasswordScreen', 'HistoryScreen', 'WorkoutDetailScreen', 'ProfileScreen']);
const stories = Object.values(index.entries).filter(e => e.type === 'story' && (ALLE || SCHERMEN.has(e.title.split('/').pop())));
if (!stories.length) { console.error('geen stories gevonden in de index'); process.exit(2); }

const server = createServer((q, r) => {
  let p = join(STATIC, decodeURIComponent(q.url.split('?')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' }); r.end(readFileSync(p));
});
await new Promise(r => server.listen(0, r));
const poort = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
const SLEUTELS = ['randkleur', 'metRand', 'placeholder', 'gescrold', 'overloop', 'inline', 'centerRight', 'marge'];
const tot = Object.fromEntries(SLEUTELS.map(k => [k, 0]));
const voorbeelden = [];
let geteld = 0, leeg = 0;

for (const s of stories) {
  const land = /landscape/i.test(s.name);
  await page.setViewportSize({ width: land ? 932 : 430, height: land ? 430 : 932 });
  await page.goto(`http://localhost:${poort}/iframe.html?id=${s.id}&viewMode=story`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const root = document.getElementById('storybook-root');
    if (!root || !root.children.length) return null;
    const px = v => parseFloat(v) || 0;
    const uit = { randkleur: 0, metRand: 0, placeholder: 0, gescrold: 0, overloop: 0, inline: 0, centerRight: 0, marge: 0, vb: [] };
    for (const el of root.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const b = [px(cs.borderTopWidth), px(cs.borderRightWidth), px(cs.borderBottomWidth), px(cs.borderLeftWidth)];
      // `metRand` is de POSITIEVE CONTROLE bij `randkleur`: zonder hem is nul niet te
      // onderscheiden van een selectie die niets raakt.
      if (Math.max(...b) > 0) {
        uit.metRand++;
        const k = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor];
        if (new Set(k.filter((_, i) => b[i] > 0)).size > 1) {
          uit.randkleur++;
          if (uit.vb.length < 2) uit.vb.push(`randkleur ${b.join('/')} ${k.join(' ')}`);
        }
      }
      if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.placeholder && !el.value) uit.placeholder++;
      if (el.scrollTop > 0 || el.scrollLeft > 0) uit.gescrold++;
      if (el.scrollHeight > el.clientHeight + 1 && !/hidden|auto|scroll/.test(cs.overflowY)) uit.overloop++;
      const eigen = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (eigen && [...el.children].some(k => k.textContent.trim())) { uit.inline++; uit.vb.push(`inline "${el.textContent.trim().slice(0, 36)}"`); }
      if (eigen && /^(center|right|end)$/.test(cs.textAlign)) uit.centerRight++;
      const m = [px(cs.marginTop), px(cs.marginRight), px(cs.marginBottom), px(cs.marginLeft)];
      if (m.some((x) => x !== 0)) { uit.marge++; if (uit.vb.length < 3) uit.vb.push(`marge ${JSON.stringify(m)}${el.getAttribute('data-testid') ? ' testid=' + el.getAttribute('data-testid') : ''}`); }
    }
    return uit;
  });
  const naam = `${s.title.split('/').pop()}/${s.name}`;
  if (!r) { leeg++; if (VERBOSE) console.log(`  ${naam}: geen render`); continue; }
  geteld++;
  for (const k of SLEUTELS) tot[k] += r[k];
  for (const v of r.vb) if (voorbeelden.length < 8) voorbeelden.push(`${naam}: ${v}`);
  if (VERBOSE) console.log(`  ${naam}: randkleur=${r.randkleur}/${r.metRand} placeholder=${r.placeholder} gescrold=${r.gescrold} overloop=${r.overloop} inline=${r.inline} center/right=${r.centerRight} marge=${r.marge}`);
}
await browser.close(); server.close();

console.log(`\nwalker-blindvlekken — ${geteld} stories geteld${leeg ? `, ${leeg} zonder render` : ''}\n`);
for (const k of SLEUTELS) console.log(`  ${k.padEnd(12)} ${String(tot[k]).padStart(5)}`);
if (voorbeelden.length) { console.log('\n  voorbeelden:'); voorbeelden.forEach(v => console.log('    ' + v)); }
console.log('\n  Dit is een meting, geen guard: elk getal boven nul is een eigenschap die de walker niet leest.');
