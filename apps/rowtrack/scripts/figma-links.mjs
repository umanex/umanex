#!/usr/bin/env node
/**
 * Schrijft `parameters.figma.url` in elk stories-bestand, afgeleid uit figma/manifest.json.
 *
 * WAAROM GEGENEREERD EN NIET MET DE HAND. Een node-id wordt door Figma UITGEGEVEN, dus je
 * leest hem terug in plaats van hem te voorspellen — en bij elke herbouw van een component
 * krijgt hij een nieuwe. Een handgeschreven deep-link is daarmee de zwakste schakel van de
 * hele sync (HANDOFF umanex-apps 2026-08-25, over precies dit gat in packages/ui).
 *
 * De link wijst naar de PRIMARY node van de pagina van dat component. `figma:check` toetst
 * dat terug: staat er een id dat niet in de manifest voorkomt, of dat bij een ander
 * component hoort, dan valt de [link]-as om.
 *
 * Gebruik: node scripts/figma-links.mjs [--check]
 *   --check schrijft niets en meldt alleen de verschillen (voor CI).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isScherm } from './schermen.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALLEEN_CHECK = process.argv.includes('--check');
const manifestPad = join(APP, 'figma/manifest.json');
if (!existsSync(manifestPad)) {
  console.error('geen figma/manifest.json — ververs hem eerst (zie apps/rowtrack/CLAUDE.md → Verify-pad)');
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPad, 'utf8'));

/** Alle stories-bestanden, met hun titel en dus hun componentnaam. */
function storyBestanden(map, prefix = '') {
  const uit = [];
  for (const naam of readdirSync(map, { withFileTypes: true })) {
    if (naam.isDirectory()) { uit.push(...storyBestanden(join(map, naam.name), prefix + naam.name + '/')); continue; }
    if (!naam.name.endsWith('.stories.tsx')) continue;
    const pad = join(map, naam.name);
    const src = readFileSync(pad, 'utf8');
    const titel = src.match(/title:\s*'([^']+)'/)?.[1] ?? null;
    uit.push({ pad, rel: prefix + naam.name, titel, component: titel?.replace(/^Componenten\//, '') ?? null, src });
  }
  return uit;
}

const stories = storyBestanden(join(APP, 'components'));
const gewijzigd = [], problemen = [];

const schermen = [];
for (const s of stories) {
  if (!s.component) { problemen.push(`${s.rel}: geen title in meta`); continue; }
  // Een scherm hoort niet in het library-bestand maar in RowTrack - Design op Screens v2,
  // dus er is geen pagina om naar te linken. Expliciet overslaan en TELLEN — een story
  // stilzwijgend overslaan ziet er identiek uit als een story die geen link nodig had.
  if (isScherm(s.component)) { schermen.push(s.rel); continue; }
  const pagina = manifest.pages[s.component];
  if (!pagina) { problemen.push(`${s.rel}: geen Figma-pagina "${s.component}" in de manifest`); continue; }
  if (!pagina.primary) { problemen.push(`${s.rel}: pagina "${s.component}" heeft geen primary node`); continue; }

  const url = `https://www.figma.com/design/${manifest.fileKey}/${encodeURIComponent(manifest.fileName)}?node-id=${pagina.primary.id.replace(':', '-')}`;
  const blok = `  parameters: {\n    figma: { url: '${url}' },\n  },`;

  let nieuw;
  if (/parameters:\s*\{\s*\n\s*figma:\s*\{\s*url:\s*'[^']*'\s*\},\s*\n\s*\},/.test(s.src)) {
    nieuw = s.src.replace(/parameters:\s*\{\s*\n\s*figma:\s*\{\s*url:\s*'[^']*'\s*\},\s*\n\s*\},/, blok.trimStart());
  } else {
    // Voeg het blok toe vlak vóór de afsluiting van meta. Anker op `} satisfies Meta`,
    // want dat staat in elk bestand precies één keer — geteld, niet aangenomen.
    const anker = s.src.match(/\n\} satisfies Meta</g);
    if (!anker || anker.length !== 1) { problemen.push(`${s.rel}: ${anker?.length ?? 0}x "} satisfies Meta<" — verwacht 1`); continue; }
    nieuw = s.src.replace(/\n\} satisfies Meta</, `\n${blok}\n} satisfies Meta<`);
  }
  if (nieuw !== s.src) {
    gewijzigd.push({ rel: s.rel, node: pagina.primary.id });
    if (!ALLEEN_CHECK) writeFileSync(s.pad, nieuw);
  }
}

console.log(`${stories.length} stories · ${gewijzigd.length} ${ALLEEN_CHECK ? 'zouden wijzigen' : 'bijgewerkt'} · ${schermen.length} schermen overgeslagen · ${problemen.length} problemen`);
for (const s of schermen) console.log(`  -- ${s} is een scherm — hoort in RowTrack - Design, niet in de library`);
for (const g of gewijzigd) console.log(`  ${ALLEEN_CHECK ? '≠' : '✓'} ${g.rel} → ${g.node}`);
for (const p of problemen) console.log(`  FOUT ${p}`);
if (problemen.length || (ALLEEN_CHECK && gewijzigd.length)) process.exitCode = 1;
