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
 * Zet de vullingsvelden op de manifest-kopie. De echte `figma/manifest.json` draagt ze pas na
 * een ververs, dus zonder dit mikt een mutatie op een overgeslagen as en kan die per
 * constructie niet rood worden.
 */
function metVulling(m, { varianten = 0, los = 0 } = {}) {
  const x = lees(m, 'figma/manifest.json');
  const paginas = Object.values(x.pages).filter(p => p.primary);
  for (const p of paginas) {
    p.primary.eigenVulling = p.primary.type === 'COMPONENT_SET' ? 1 : 0;
    p.primary.variantenMetVulling = p.primary.type === 'COMPONENT_SET' ? 0 : null;
  }
  const sets = paginas.filter(p => p.primary.type === 'COMPONENT_SET');
  const losse = paginas.filter(p => p.primary.type !== 'COMPONENT_SET');
  for (const p of sets.slice(0, varianten)) p.primary.variantenMetVulling = 3;
  for (const p of losse.slice(0, los)) p.primary.eigenVulling = 1;
  schrijf(m, 'figma/manifest.json', x);
}

/**
 * Breng de manifest-kopie op schema 3 en zet er een publicatietoestand op.
 * `specDagenNieuwer` verzet de mtime van de bouwspec vooruit — dat is wat de guard leest,
 * en het is de enige manier om het "spec is jonger dan Figma"-venster op te wekken zonder
 * te wachten tot morgen.
 */
function schema3(m, { publiceer = 0, bouwhash = true } = {}) {
  const x = lees(m, 'figma/manifest.json');
  x.schemaVersie = 3;
  const paginas = Object.values(x.pages).filter(p => p.primary);
  for (const p of paginas) { p.primary.publishStatus = 'UNPUBLISHED'; p.primary.bouwhash = 'abc123:12'; }
  for (const p of paginas.slice(0, publiceer)) {
    p.primary.publishStatus = 'PUBLISHED';
    if (!bouwhash) delete p.primary.bouwhash;
  }
  schrijf(m, 'figma/manifest.json', x);
}

/**
 * Maak van de wegwerpkopie een git-repo en leg de twee bestanden in de gevraagde VOLGORDE vast.
 *
 * De `[publicatie]`-as leest sinds 2026-09-08 commit-tijden in plaats van mtimes: git bewaart
 * geen mtimes, dus elke verse checkout stempelde "nu" en de as gaf vals alarm, terwijl het
 * echte venster — een herbouw twee uur ná de ververs — op dagresolutie onzichtbaar was. Een
 * tegenproef op mtime meet die as dus niet meer; hij moet door dezelfde poort als de echte code.
 */
function commitVolgorde(m, eerst, daarna) {
  const git = (args, datum) => execFileSync('git', args, {
    cwd: m, stdio: 'ignore',
    env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum,
           GIT_AUTHOR_NAME: 'selftest', GIT_AUTHOR_EMAIL: 's@e', GIT_COMMITTER_NAME: 'selftest', GIT_COMMITTER_EMAIL: 's@e' },
  });
  git(['init', '-q']);
  git(['add', eerst]);
  git(['commit', '-q', '-m', 'eerst'], '2026-09-08T10:00:00+02:00');
  git(['add', daarna]);
  git(['commit', '-q', '-m', 'daarna'], '2026-09-08T14:00:00+02:00');
}

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

  // --- publicatie-as: het manifest op schema 3 zetten en dan pas breken ----
  // De echte figma/manifest.json staat nog op schema 2, dus de as slaat over op de ware
  // invoer. Een mutatie die op een overgeslagen as mikt kan per constructie niet rood
  // worden; daarom brengt elke mutatie hier eerst de invoer in de toestand waarin de as
  // iets te zeggen heeft. De derde is de tegenhanger: dezelfde schema-3-invoer, maar
  // gezond — die hoort de guard groen te laten.
  { as: 'publicatie', wat: 'publiceer een component zonder bouwhash', doe: m => {
      schema3(m, { publiceer: 2, bouwhash: false }); } },
  { as: 'publicatie', wat: 'commit de bouwspec ná de Figma-momentopname', doe: m => {
      schema3(m, { publiceer: 2, bouwhash: true });
      commitVolgorde(m, 'figma/manifest.json', 'figma/build-spec.min.json'); } },
  { as: 'controle-publicatie', zwijgt: true, wat: 'commit de bouwspec vóór de Figma-momentopname', doe: m => {
      schema3(m, { publiceer: 2, bouwhash: true });
      commitVolgorde(m, 'figma/build-spec.min.json', 'figma/manifest.json'); } },

  // --- laagnaam-as: vier defecten, twee controles -------------------------
  { as: 'laagnaam', wat: 'laat een node een kaal cijfer heten', doe: m => {
      const x = lees(m, 'figma/laagnamen.json'); x.indexNamen = 2; schrijf(m, 'figma/laagnamen.json', x); } },
  { as: 'laagnaam', wat: 'laat een tekstnode zijn eigen copy dragen', doe: m => {
      const x = lees(m, 'figma/laagnamen.json'); x.copyNamen = 1; schrijf(m, 'figma/laagnamen.json', x); } },
  { as: 'laagnaam', wat: 'laat twee isomorfe varianten uit elkaar lopen', doe: m => {
      const x = lees(m, 'figma/laagnamen.json'); x.instabiel = ['ErrorState: variant 0 tegen 1']; schrijf(m, 'figma/laagnamen.json', x); } },
  { as: 'laagnaam', wat: 'laat de dekking dalen', doe: m => {
      const x = lees(m, 'figma/laagnamen.json'); x.echteNaamPct = 60; schrijf(m, 'figma/laagnamen.json', x); } },
  { as: 'laagnaam', wat: 'laat de dekking stijgen (ratel moet bijgesteld)', doe: m => {
      const x = lees(m, 'figma/laagnamen.json'); x.echteNaamPct = 88.4; schrijf(m, 'figma/laagnamen.json', x); } },
  { as: 'laagnaam', wat: 'een nieuwe naamconflict-bron (instabielePosities stijgt)', doe: m => {
      const x = lees(m, 'figma/laagnamen.json'); x.instabielePosities = 9;
      x.instabielPerComponent = ['Chip:7', 'DeviceRow:1', 'KPI:1']; schrijf(m, 'figma/laagnamen.json', x); } },
  { as: 'laagnaam', wat: 'de producent levert het veld niet meer', doe: m => {
      const x = lees(m, 'figma/laagnamen.json'); delete x.instabielePosities; schrijf(m, 'figma/laagnamen.json', x); } },
  // --- laagnaam-as, componentgrens: zes defecten, twee controles ---------
  // De grens heeft TWEE helften die niet hetzelfde meten — "staat in de code" en "bereikte de
  // DOM". Ze krijgen daarom elk hun eigen mutatie; één van de twee zou de andere maskeren.
  { as: 'laagnaam', wat: 'haal het testID uit een componentbestand (code-helft)', doe: m => {
      const f = join(m, 'components/Chip.tsx');
      writeFileSync(f, readFileSync(f, 'utf8').replace('testID="Chip"', '')); } },
  { as: 'laagnaam', wat: 'de testID haalt de DOM niet (dom-helft)', doe: m => {
      const x = lees(m, 'figma/build-spec.min.json');
      x.gezien.testid = x.gezien.testid.filter(t => t !== 'Chip'); schrijf(m, 'figma/build-spec.min.json', x); } },
  { as: 'laagnaam', wat: 'een spec van vóór de componentgrens', doe: m => {
      const x = lees(m, 'figma/build-spec.min.json'); x.walkerVersie = 1; schrijf(m, 'figma/build-spec.min.json', x); } },
  { as: 'laagnaam', wat: 'een testID in camelCase in plaats van PascalCase', doe: m => {
      const x = lees(m, 'figma/build-spec.min.json'); x.gezien.testid.push('chipRow'); schrijf(m, 'figma/build-spec.min.json', x); } },
  { as: 'laagnaam', wat: 'de dieptekap gooit een componentgrens weg', doe: m => {
      const x = lees(m, 'figma/build-spec.min.json'); x.weggelatenComponenten = 3; schrijf(m, 'figma/build-spec.min.json', x); } },
  { as: 'laagnaam', wat: 'de heuristische grens vuurt vaker', doe: m => {
      const x = lees(m, 'figma/laagnamen.json'); x.componentZonderTestID = 7;
      x.heuristiekPerComponent = ['ActivePhase:4', 'IdlePhase:3']; schrijf(m, 'figma/laagnamen.json', x); } },
  { as: 'controle-testidElders', verwachtCode: 0, wat: 'zet een testID in een NIET-componentbestand',
    doe: m => { const f = join(m, 'components/PaceZone.tsx');
      writeFileSync(f, readFileSync(f, 'utf8') + '\n// testID="Verzonnen"\n'); } },
  { as: 'controle-grensDiepte', verwachtCode: 0, wat: 'verdiep een gemeten grens in het rapport',
    doe: m => { const x = lees(m, 'figma/build-spec.min.json');
      x.grenzen.Chip = { diepte: 9, boven: ['doorvoer'] }; schrijf(m, 'figma/build-spec.min.json', x); } },

  // Ambiguïteit is een RAPPORTAGE, geen defect: twee sleutels die even goed passen geven een
  // deterministische maar willekeurige keuze. Zou de as hierop afgaan, dan was hij niet meer
  // te onderscheiden van een echte naamfout.
  { as: 'controle-ambigu', zwijgt: true, wat: 'verdrievoudig het aantal ambigue nodes', doe: m => {
      const x = lees(m, 'figma/laagnamen.json'); x.ambigu = 999; schrijf(m, 'figma/laagnamen.json', x); } },
  { as: 'controle-naamlijst', zwijgt: true, wat: 'hernoem een laag in de namen-telling', doe: m => {
      const x = lees(m, 'figma/laagnamen.json');
      const k = Object.keys(x.namen)[0]; x.namen['zomaarwat'] = x.namen[k]; delete x.namen[k];
      schrijf(m, 'figma/laagnamen.json', x); } },

  // --- instancevulling: wat reist er mee naar een instance? ---------------
  { as: 'instancevulling', wat: 'geef twee varianten een eigen vulling', doe: m => {
      metVulling(m, { varianten: 2 }); } },
  { as: 'instancevulling', wat: 'geef een losse component een eigen vulling', doe: m => {
      metVulling(m, { los: 1 }); } },
  // De SET mág een vulling hebben — die reist juist NIET mee. Ging de as hierop af, dan zou
  // hij de fix onmogelijk maken in plaats van hem af te dwingen.
  { as: 'controle-setvulling', zwijgt: true, wat: 'alle sets houden hun eigen vulling', doe: m => {
      metVulling(m, { varianten: 0, los: 0 }); } },

  // --- onvolledige meting: exit 2, niet exit 0 ----------------------------
  // `sla()` schrijft alleen een ~~-regel. Tot 2026-09-08 bepaalde alléén `fails` de
  // exit-code, dus tien overgeslagen assen gaven exit 0 mét een slotregel die alle dertien
  // bij naam opsomde. Geen van de 26 mutaties raakte dat pad: elke mutatie eist een FAIL en
  // elke controle eist exit 0 — de skip-tak zat er precies tussenin.
  { as: 'onvolledig', verwachtCode: 2, wat: 'haal het manifest weg (tien assen zonder invoer)',
    doe: m => rmSync(join(m, 'figma/manifest.json')) },
  { as: 'onvolledig-laagnamen', verwachtCode: 2, wat: 'haal figma/laagnamen.json weg',
    doe: m => rmSync(join(m, 'figma/laagnamen.json')) },

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
  const geslaagd = m.verwachtCode !== undefined ? r.code === m.verwachtCode
                 : m.zwijgt ? r.code === 0
                 : (r.code === 1 && raakt);
  const hoort = m.verwachtCode !== undefined ? ` (hoort ${m.verwachtCode})`
              : m.zwijgt ? ' (hoort 0)' : ` (hoort 1 op [${m.as}])`;
  console.log(`  ${geslaagd ? 'ok' : 'XX'} ${m.as.padEnd(20)} ${m.wat} → exit ${r.code}${hoort}`);
  if (!geslaagd && !m.zwijgt && m.verwachtCode === undefined) {
    const fails = r.uit.split('\n').filter(l => l.startsWith('  FAIL')).slice(0, 3);
    if (fails.length) console.log('       viel om op: ' + fails.join(' | ').trim());
    else console.log('       geen enkele FAIL — deze as kan het defect niet opwekken');
  }
  geslaagd ? goed++ : fout++;
  rmSync(map, { recursive: true, force: true });
}

console.log(`\n${goed} van ${MUTATIES.length} mutaties gedroegen zich zoals bedoeld.`);
if (fout) { console.log(`${fout} niet — die as meet niet wat hij beweert te meten.`); process.exit(1); }
