#!/usr/bin/env node
/**
 * geometry-parity.mjs — de maat-as tussen Figma en de browser, per variant-node.
 *
 * `figma-sync-check.mjs` toetst namen, assen, tokenwaarden en typografie-herkomst.
 * `geometry-check.mjs` toetst de gerenderde maten tegen een basislijn van zichzelf.
 * Geen van beide legt de twee kanten naast elkaar. Dit script doet dat.
 *
 * De join-sleutel zijn de variant-nodes uit `figma/geometry.figma.json` (68 stuks): een
 * Figma-variant heet `variant=default, size=sm, disabled=false`, en precies die assen zijn
 * de args van de Storybook-playground. Zonder die nodes bestond de koppeling niet — dat was
 * tot 2026-09-07 het gat waardoor deze as niet gebouwd kón worden.
 *
 * WAT ER VERGELEKEN WORDT, en waarom juist dit:
 *   hoogte · horizontale padding · gap · radius · border-breedte · opacity · vulling/rand
 *
 * WAT ER BEWUST BUITEN BLIJFT:
 *   · BREEDTE — tekstgedreven. Figma's tekstengine en Chromium's font-metrics geven andere
 *     getallen bij identieke tekst; gemeten in CI als zestien valse verschillen op één dag.
 *   · VERTICALE PADDING — bij een vaste hoogte bepaalt die de doos niet. Figma zet 0 met een
 *     frame van 40px, de code zet `py-2` binnen `h-10`. Beide renderen 40. Vergelijken zou
 *     op elke knop een verschil geven dat er niet is.
 *   · KLEUR, SCHADUW, ICOONVORM — daarvoor is een beeldvergelijking nodig, en die is in
 *     Chromium geen identiteitstoets (≤18px AA-ruis, umanex-os LEARNINGS 2026-08-25). Wel
 *     vergeleken wordt de AANWEZIGHEID van een vulling, rand of effect: een getal dat niets
 *     tekent is anders ook een groene meting.
 *
 * Gebruik:  node scripts/geometry-parity.mjs [--verbose]
 * Vereist `pnpm --filter @umanex/ui build-storybook`.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ui = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC = join(ui, 'storybook-static');
const VERBOSE = process.argv.includes('--verbose');

/**
 * Component set → story-id én de selector van het component zélf.
 *
 * De selector is niet te raden. Elke story zit achter dezelfde decorator uit `preview.tsx`
 * (`div.bg-background.p-6`), en bij Checkbox, Slider en Separator zit het component nóg een
 * of twee niveaus dieper in een voorbeeldopstelling. De eerste versie van dit script nam het
 * eerste kind van `#storybook-root` en mat daardoor 72px hoog met 24px padding voor élke
 * variant — de decorator, niet het component. Deze selectors zijn afgelezen uit de
 * gerenderde DOM, niet afgeleid uit de code.
 */
const STORY = {
  Badge:       { id: 'componenten-badge--playground',      sel: '[class*="rounded-full"]' },
  Button:      { id: 'componenten-button--playground',     sel: 'button' },
  Checkbox:    { id: 'componenten-checkbox--playground',   sel: 'button[role="checkbox"]' },
  Input:       { id: 'componenten-input--playground',      sel: 'input' },
  // De story volgt de variant: één vaste story zou de verticale variant tegen de
  // horizontale render leggen (gemeten: Figma 80 tegen code 1 — mijn harnas, geen drift).
  Separator:   { perVariant: v => ({
                   id: `componenten-separator--${v.split('=')[1]}`,
                   sel: `[data-orientation="${v.split('=')[1]}"]`,
                   // `h-full w-[1px]` bij vertical: de hoogte ís die van de ouder, dus een
                   // vergelijking meet de story-opstelling en niet het component.
                   nietVergelijkbaar: v.includes('vertical') ? ['hoogte'] : [] }) },
  // Slider: hoogte NIET vergelijkbaar. Figma's frame is 20px hoog omdat het de thumb omvat;
  // de root in code is 8px (de track, h-2) met een absoluut gepositioneerde thumb van h-5
  // die buiten de doos valt. Twee verschillende dozen om hetzelfde ding — gemeten 20 tegen 8.
  Slider:      { id: 'componenten-slider--playground', sel: '[class*="touch-none"]',
                 nietVergelijkbaar: ['hoogte'] },
  // state komt uit Radix' data-state, niet uit een prop — geen playground met deze as.
  TabsTrigger: null,
  // mode is interne useState, geen prop. Zelfde uitsluiting als FIGMA_ONLY in de sync-guard.
  ThemeToggle: null,
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png' };
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

/** `variant=default, size=sm, disabled=false` → Storybook-args. Booleans krijgen `!`. */
const argsVan = naam => naam.split(',').map(p => {
  const [k, v] = p.trim().split('=');
  return `${k}:${v === 'true' || v === 'false' ? '!' + v : v}`;
}).join(';');

const meet = (sel) => {
  const root = document.querySelector('#storybook-root');
  const treffers = [...(root ? root.querySelectorAll(sel) : [])];
  if (!treffers.length) return { fout: `0 treffers op '${sel}'` };
  // Tel eerst. Meer dan één treffer betekent niet meteen een fout — de vertical-story van
  // Separator rendert er twee — maar je mag er pas een eigenschap van aflezen als ze
  // aantoonbaar dezelfde doos zijn. Anders zegt de meting iets over een willekeurige node.
  if (treffers.length > 1) {
    const doos = e => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
      return [Math.round(r.height * 100) / 100, c.padding, c.borderRadius, c.borderWidth, c.opacity].join('|'); };
    const eerste = doos(treffers[0]);
    if (!treffers.every(e => doos(e) === eerste))
      return { fout: `${treffers.length} treffers op '${sel}' met verschillende dozen` };
  }
  const el = treffers[0];
  const meervoud = treffers.length > 1 ? treffers.length : 0;
  const s = getComputedStyle(el), r = el.getBoundingClientRect();
  const kleurZichtbaar = c => c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent';
  return {
    h: Math.round(r.height * 100) / 100,
    padX: [parseFloat(s.paddingRight), parseFloat(s.paddingLeft)],
    gap: s.columnGap === 'normal' ? 0 : parseFloat(s.columnGap) || 0,
    r: parseFloat(s.borderTopLeftRadius),
    bw: parseFloat(s.borderTopWidth),
    op: Math.round(parseFloat(s.opacity) * 100) / 100,
    fills: kleurZichtbaar(s.backgroundColor) ? 1 : 0,
    strokes: (parseFloat(s.borderTopWidth) > 0 && kleurZichtbaar(s.borderTopColor)) ? 1 : 0,
    eff: s.boxShadow && s.boxShadow !== 'none' ? 1 : 0,
    meervoud,
  };
};

/**
 * Bekende afwijkingen: gemeten verschillen die geen fout in dit script zijn maar een echt
 * verschil tussen de twee kanten, met de richting van de oplossing erbij. Tweezijdig, net
 * als BEKENDE_GATEN in de dekkings-as: een nieuw verschil faalt, én een verschil dat is
 * opgelost faalt óók, zodat de lijst niet stil veroudert.
 */
const BEKENDE_AFWIJKINGEN = {
  'Badge/variant=default hoogte': 'code geeft élke Badge `border` (1px, transparant op de gevulde varianten) → 22px; Figma tekent alleen op `outline` een stroke → 20px. Code is de bron, dus Figma hoort een transparante 1px-stroke te krijgen.',
  'Badge/variant=secondary hoogte': 'idem — transparante border in de code, geen stroke in Figma',
  'Badge/variant=destructive hoogte': 'idem — transparante border in de code, geen stroke in Figma',
  'Badge/variant=success hoogte': 'idem — transparante border in de code, geen stroke in Figma',
  'Badge/variant=warning hoogte': 'idem — transparante border in de code, geen stroke in Figma',
};

const fig = JSON.parse(readFileSync(join(ui, 'figma/geometry.figma.json'), 'utf8'));
const { server, poort } = await serve(STATIC);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const verschillen = [], overgeslagen = [], onmeetbaar = new Set(), bekend = new Set();
let getoetst = 0;
for (const [set, varianten] of Object.entries(fig.gemeten)) {
  const cfg = STORY[set];
  if (!cfg) { overgeslagen.push(`${set}: geen playground met deze assen als props`); continue; }
  for (const [naam, f] of Object.entries(varianten)) {
    const story = cfg.perVariant ? { ...cfg, ...cfg.perVariant(naam) } : cfg;
    const url = `http://127.0.0.1:${poort}/iframe.html?id=${story.id}&viewMode=story&args=${encodeURIComponent(argsVan(naam))}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const c = await page.evaluate(meet, story.sel);
    if (!c) { verschillen.push(`${set}/${naam}: story rendert niets`); continue; }
    if (c.fout) { verschillen.push(`${set}/${naam}: ${c.fout}`); continue; }
    if (c.meervoud) onmeetbaar.add(`${set}: ${c.meervoud} identieke exemplaren in de story, eerste gemeten`);
    getoetst++;
    const paren = [
      ['hoogte', f.h, c.h], ['radius', f.r === 9999 ? c.r : f.r, c.r],
      ['padding-links', f.pad[3], c.padX[1]], ['padding-rechts', f.pad[1], c.padX[0]],
      ['gap', f.gap, c.gap], ['opacity', f.op, c.op],
      ['vulling', f.fills > 0 ? 1 : 0, c.fills], ['rand', f.strokes > 0 ? 1 : 0, c.strokes],
      ['effect', f.eff > 0 ? 1 : 0, c.eff],
    ];
    for (const [wat, a, b] of paren) {
      if (story.nietVergelijkbaar?.includes(wat)) { onmeetbaar.add(`${set}: ${wat}`); continue; }
      const sleutel = `${set}/${naam} ${wat}`;
      const afwijkt = Math.abs(Number(a) - Number(b)) > 0.51;
      if (afwijkt && BEKENDE_AFWIJKINGEN[sleutel]) { bekend.add(sleutel); continue; }
      if (!afwijkt && BEKENDE_AFWIJKINGEN[sleutel]) {
        verschillen.push(`${sleutel}: staat als bekende afwijking maar is nu gelijk — haal hem uit BEKENDE_AFWIJKINGEN`);
        continue;
      }
      if (afwijkt) verschillen.push(`${sleutel}: Figma ${a} tegen code ${b}`);
    }
    if (VERBOSE) console.log(`  · ${set}/${naam}: h ${f.h}/${c.h} r ${f.r}/${c.r} pad ${f.pad[3]}/${c.padX[1]} op ${f.op}/${c.op}`);
  }
}
await browser.close(); server.close();

if (!getoetst) { console.error('✗ nul varianten getoetst — de as meet niets.'); process.exit(1); }
for (const o of overgeslagen) console.log('  ~~ ' + o);
for (const o of onmeetbaar) console.log('  ~~ onmeetbaar — ' + o);
for (const b of bekend) console.log(`  !!  bekende afwijking — ${b}: ${BEKENDE_AFWIJKINGEN[b]}`);
if (verschillen.length) {
  console.error(`\n✗ geometry-parity — ${verschillen.length} verschil(len) over ${getoetst} varianten:\n`);
  for (const v of verschillen.slice(0, 30)) console.error('  ' + v);
  if (verschillen.length > 30) console.error(`  … en ${verschillen.length - 30} meer`);
  process.exit(1);
}
console.log(`\n✓ geometry-parity: ${getoetst} varianten, Figma en browser gelijk op hoogte, padding, gap, radius, rand, opacity en de aanwezigheid van vulling/rand/effect.`);
console.log(`  Niet vergeleken: breedte (tekstgedreven), verticale padding (bij vaste hoogte), en kleur/schaduw/icoonvorm.`);
if (overgeslagen.length) console.log(`  ${overgeslagen.length} set(s) overgeslagen — zie de ~~-regels.`);
