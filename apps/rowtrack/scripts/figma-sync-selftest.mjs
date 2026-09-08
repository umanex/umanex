#!/usr/bin/env node
/**
 * Tegenproef voor figma-sync-check.mjs.
 *
 * Dat een check rood KAN worden is niet genoeg — hij moet rood worden op precies het defect
 * waarvoor hij bestaat. Deze zelftest maakt per as een wegwerpkopie van de invoer, muteert
 * één veld, en eist dat de guard op díe as omvalt. Daarnaast draait hij CONTROLE-mutaties op
 * velden die de guard niet leest, en eist dat hij daar zwijgt.
 *
 * Geven beide kanten dezelfde uitkomst, dan is dat geen dubbele bevestiging maar de melding
 * dat de opstelling het defect niet kán opwekken.
 *
 * Gebruik: node scripts/figma-sync-selftest.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = join(APP, 'scripts/figma-sync-check.mjs');

/** Draai de guard op een kopie; geeft {code, uit}. */
function draai(root) {
  try {
    const uit = execFileSync(process.execPath, [GUARD, `--root=${root}`], { encoding: 'utf8' });
    return { code: 0, uit };
  } catch (e) {
    return { code: e.status ?? 1, uit: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

function kopie() {
  const map = join(tmpdir(), `rowtrack-selftest-${Number(process.hrtime.bigint() % 1000000n)}`);
  if (existsSync(map)) rmSync(map, { recursive: true });
  mkdirSync(map, { recursive: true });
  for (const sub of ['figma', 'components', 'tokens', 'scripts']) {
    if (existsSync(join(APP, sub))) cpSync(join(APP, sub), join(map, sub), { recursive: true });
  }
  return map;
}
const lees = (m, p) => JSON.parse(readFileSync(join(m, p), 'utf8'));
const schrijf = (m, p, o) => writeFileSync(join(m, p), JSON.stringify(o, null, 1));

/**
 * Elke mutatie: wat hij kapotmaakt, en welke as daarop hoort af te gaan.
 * `zwijgt: true` = controle-mutatie, de guard hoort NIET af te gaan.
 */
const MUTATIES = [
  { as: 'dekking', wat: 'verwijder een stories-bestand', doe: m => rmSync(join(m, 'components/Chip.stories.tsx')) },
  { as: 'pagina', wat: 'haal een pagina uit de manifest', doe: m => {
      const x = lees(m, 'figma/manifest.json'); delete x.pages.Chip; schrijf(m, 'figma/manifest.json', x); } },
  { as: 'variant', wat: 'verwijder een variant-as in Figma', doe: m => {
      const x = lees(m, 'figma/manifest.json');
      const p = Object.values(x.pages).find(p2 => p2.primary?.variantProperties);
      p.primary.variantProperties = { verzonnen: { values: ['a'] } };
      schrijf(m, 'figma/manifest.json', x); } },
  { as: 'varianten', wat: 'gooi één variant-node weg', doe: m => {
      const x = lees(m, 'figma/manifest.json');
      const p = Object.values(x.pages).find(p2 => (p2.primary?.varianten?.length ?? 0) > 1);
      p.primary.varianten.pop(); schrijf(m, 'figma/manifest.json', x); } },
  { as: 'token', wat: 'verwijder een Figma-variabele', doe: m => {
      const x = lees(m, 'figma/manifest.json');
      x.collections.Theme.variables = x.collections.Theme.variables.filter(n => n !== 'accent/default');
      schrijf(m, 'figma/manifest.json', x); } },
  { as: 'tokenwaarde', wat: 'verf een kleur in Figma anders', doe: m => {
      const x = lees(m, 'figma/manifest.json');
      const w = x.collections.Core?.waarden;
      if (!w) throw new Error('manifest zonder Core-waarden');
      const sleutel = Object.keys(w).find(k => w[k].waarde?.r !== undefined);
      w[sleutel].waarde = { r: 0, g: 1, b: 0, a: 1 };
      schrijf(m, 'figma/manifest.json', x); } },
  { as: 'typografie', wat: 'zet een text style op een andere grootte', doe: m => {
      const x = lees(m, 'figma/manifest.json');
      x.textStyles[0].fontSize = 99; schrijf(m, 'figma/manifest.json', x); } },
  { as: 'link', wat: 'laat een deep-link naar een onbestaande node wijzen', doe: m => {
      const p = join(m, 'components/Chip.stories.tsx');
      writeFileSync(p, readFileSync(p, 'utf8').replace(/node-id=[\w-]+/, 'node-id=9999-9999')); } },
  { as: 'hardcoded', wat: 'zet een hex-kleur in een story', doe: m => {
      const p = join(m, 'components/Chip.stories.tsx');
      writeFileSync(p, readFileSync(p, 'utf8').replace('export const Playground', "const KLEUR = '#ABCDEF';\nexport const Playground")); } },
  // Let op het BESTAND: de guard leest figma/ongebonden.json, niet de 6 MB build-spec.json.
  // De eerste versie van deze mutatie muteerde het verkeerde bestand en gaf exit 0 — de as
  // leek daardoor "kan niet rood worden" terwijl hij prima werkt. Een tegenproef die het
  // verkeerde object aanraakt meet zichzelf, niet de guard.
  { as: 'binding', wat: 'voeg een ongebonden waarde toe', doe: m => {
      const x = lees(m, 'figma/ongebonden.json');
      x.uniek.push('achtergrond = {"r":1,"g":2,"b":3,"a":1}');
      x.aantalUniek = x.uniek.length;
      schrijf(m, 'figma/ongebonden.json', x); } },
  { as: 'binding', wat: 'los een gat op (aantal daalt)', doe: m => {
      const x = lees(m, 'figma/ongebonden.json');
      x.uniek.pop(); x.aantalUniek = x.uniek.length;
      schrijf(m, 'figma/ongebonden.json', x); } },

  // --- controle-mutaties: velden die de guard NIET leest -------------------
  { as: 'controle-fileName', zwijgt: true, wat: 'hernoem het Figma-bestand', doe: m => {
      const x = lees(m, 'figma/manifest.json'); x.fileName = 'Iets Anders'; schrijf(m, 'figma/manifest.json', x); } },
  { as: 'controle-storyNaam', zwijgt: true, wat: 'hernoem een named story (geen Playground)', doe: m => {
      const p = join(m, 'components/Chip.stories.tsx');
      writeFileSync(p, readFileSync(p, 'utf8').replace('export const Actief', 'export const Aangezet')); } },
];

const basis = draai(APP);
console.log(`basis (ongemuteerd): exit ${basis.code}`);
if (basis.code !== 0) {
  console.log('De guard is op de echte invoer al rood — de zelftest kan niets onderscheiden.');
  console.log(basis.uit.split('\n').filter(r => r.includes('FAIL') || r.includes('~~')).slice(0, 12).join('\n'));
  process.exit(2);
}

let goed = 0, fout = 0;
for (const m of MUTATIES) {
  const map = kopie();
  let r;
  try {
    m.doe(map);
    r = draai(map);
  } catch (e) {
    console.log(`  ?? ${m.as.padEnd(20)} mutatie zelf faalde: ${e.message}`);
    rmSync(map, { recursive: true, force: true }); fout++; continue;
  }
  const raakt = r.uit.includes(`[${m.as}]`) && r.uit.split('\n').some(l => l.startsWith('  FAIL') && l.includes(`[${m.as}]`));
  const geslaagd = m.zwijgt ? r.code === 0 : (r.code === 1 && raakt);
  console.log(`  ${geslaagd ? 'ok' : 'XX'} ${m.as.padEnd(20)} ${m.wat} → exit ${r.code}${m.zwijgt ? ' (hoort 0)' : ` (hoort 1 op [${m.as}])`}`);
  if (!geslaagd && !m.zwijgt) {
    const fails = r.uit.split('\n').filter(l => l.startsWith('  FAIL')).slice(0, 3);
    if (fails.length) console.log('       viel om op: ' + fails.join(' | ').trim());
    else console.log('       geen enkele FAIL — deze as kan het defect niet opwekken');
  }
  geslaagd ? goed++ : fout++;
  rmSync(map, { recursive: true, force: true });
}

console.log(`\n${goed} van ${MUTATIES.length} mutaties gedroegen zich zoals bedoeld.`);
if (fout) { console.log(`${fout} niet — die as meet niet wat hij beweert te meten.`); process.exit(1); }
