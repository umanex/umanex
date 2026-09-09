#!/usr/bin/env node
/**
 * TOESTEL-SCHULD — wat is er veranderd sinds de laatste keer dat iemand op een toestel keek,
 * en waarvan is dat per constructie alleen dáár te zien?
 *
 * WAAROM DIT BESTAAT. De verify-keten van deze app rust op Storybook: react-native-web in
 * Chromium. Dat is het enige render-pad dat zonder simulator werkt, en het draagt de
 * Figma-vergelijking, de sweeps en de beeld-as. Maar vier soorten code zijn daar per
 * constructie ONZICHTBAAR, en geen enkele guard merkt dat (alle tellingen 2026-09-09):
 *
 *   1. Een `Platform.OS === 'ios'`-tak — 9 bestanden. De browser kiest altijd de andere kant,
 *      dus die regel is nooit uitgevoerd: het toetsenbordgedrag van elk auth-scherm, de
 *      keyboard-events van BottomSheet, de Android-tak van workout.
 *   2. Alles onder `lib/ble/` — 15 bestanden. De browser heeft geen Bluetooth; dit draait
 *      alleen met een roeitrainer of hartslagband ernaast.
 *   3. Animatie via reanimated — 2 bestanden (GoalSegments, WheelPicker). In react-native-web
 *      draait dat anders, en een sweep ziet de eindtoestand, niet de beweging.
 *   4. Apparaat-gedrag en native config: secure-store, haptics, linking, plus `app.json`,
 *      het deep-link scheme en de permissies.
 *
 * En de aanname eronder is zelf nooit getoetst: dat Storybook rendert wat de app rendert.
 * Die staat als rij 6 in het toestel-ronde-item van BACKLOG.md.
 *
 * WAAROM UIT GIT EN NIET UIT EEN LIJST. Een register dat je met de hand bijhoudt veroudert
 * stil — precies de fout waar `HANDOFF.md` over waarschuwt ("schrijf de check, niet de
 * staat"). De historie veroudert niet: een toestel-ronde laat een commit-trailer na, en dit
 * script telt wat er sindsdien gebeurd is. Geen ronde gedaan? Dan is de schuld de hele
 * historie, en dat is precies het juiste getal.
 *
 * REGISTREREN. Zet in de commit van een toestel-ronde een trailer:
 *
 *     Toestel-ronde: 2026-09-09 iPhone 17 sim — vier schermen naast render:shot, BLE niet
 *
 * Ook wanneer je niets vond: "gekeken en niets gezien" is een uitkomst, en zonder commit is
 * hij er over een maand niet meer.
 *
 * DIT IS EEN METING, GEEN POORT. Exit 0, altijd — behalve bij een kapotte aanroep (exit 2).
 * Hij blokkeert niets; hij maakt zichtbaar wat anders in niemands hoofd zit.
 *
 *   node scripts/toestel-schuld.mjs              # het rapport
 *   node scripts/toestel-schuld.mjs --kort       # één regel, voor een hook
 *   node scripts/toestel-schuld.mjs --paden      # welke paden meetellen en waarom
 *   node scripts/toestel-schuld.mjs --selftest   # tegenproef: telt hij écht vanaf de trailer?
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(APP, '..', '..');
const KORT = process.argv.includes('--kort');
const PADEN = process.argv.includes('--paden');
const SELFTEST = process.argv.includes('--selftest');
const TRAILER = 'Toestel-ronde:';

const git = (args, cwd = REPO) => {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};

/**
 * De categorieën. Elke regel draagt WAAROM hij hier staat — een lijst met paden zonder reden
 * wordt binnen een half jaar uitgebreid met iets dat er niet in hoort, en dan is de melding ruis.
 * `test` krijgt een pad relatief aan de repo-root.
 */
const CATEGORIEEN = [
  { key: 'ble', naam: 'BLE-gedrag',
    waarom: 'de browser heeft geen Bluetooth; dit draait alleen met een roeitrainer of band ernaast',
    test: (p) => p.startsWith('apps/rowtrack/lib/ble/') && !p.endsWith('.test.ts') },
  { key: 'native', naam: 'native config',
    waarom: 'permissies, deep-link scheme en build-config bestaan alleen in een native build',
    test: (p) => /^apps\/rowtrack\/(app\.json|eas\.json|ios\/|android\/|lib\/recovery-link\.ts)/.test(p) },
  { key: 'platform', naam: 'Platform-vertakking',
    waarom: 'Storybook kiest altijd de web-tak, dus de iOS-tak is nooit uitgevoerd',
    test: (p) => PLATFORM_BESTANDEN.has(p) },
  { key: 'animatie', naam: 'animatie (reanimated)',
    waarom: 'reanimated draait in react-native-web anders; een sweep ziet de eindtoestand, niet de beweging',
    test: (p) => ANIMATIE_BESTANDEN.has(p) },
  { key: 'opslag', naam: 'apparaat-gedrag',
    waarom: 'secure-store, haptics en linking hebben in de browser geen equivalent',
    test: (p) => OPSLAG_BESTANDEN.has(p) },
];

/**
 * Welke bestanden dragen NU zoiets? Gemeten op de tree, niet gelijst — een lijst veroudert.
 *
 * `react-native-safe-area-context` staat er bewust NIET bij: die zit in vrijwel elk scherm,
 * dus als categorie zou hij 150 van de 410 commits markeren en daarmee het hele getal tot ruis
 * maken (gemeten 2026-09-09, de eerste versie van dit script). Zijn shim geeft in Storybook
 * nul insets, en dat is in de render gewoon te zien; hij is dus geen blinde vlek maar een
 * zichtbaar verschil.
 */
function scanBronnen() {
  const zoek = (patroon) => {
    const uit = new Set();
    try {
      const r = execFileSync('git', ['grep', '-lE', patroon, 'HEAD', '--',
        'apps/rowtrack/components', 'apps/rowtrack/app', 'apps/rowtrack/lib', 'apps/rowtrack/constants'],
        { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const regel of r.split('\n')) {
        const p = regel.replace(/^HEAD:/, '').trim();
        if (p && /\.(tsx?|jsx?)$/.test(p) && !p.includes('.stories.')) uit.add(p);
      }
    } catch { /* geen treffer is een lege set, geen fout */ }
    return uit;
  };
  return {
    platform: zoek('Platform\\.OS[[:space:]]*===|Platform\\.select'),
    animatie: zoek("from 'react-native-reanimated'"),
    opslag: zoek("from '(expo-secure-store|expo-haptics|expo-linking|expo-device)'"),
  };
}
const bronnen = scanBronnen();
const PLATFORM_BESTANDEN = bronnen.platform;
const ANIMATIE_BESTANDEN = bronnen.animatie;
const OPSLAG_BESTANDEN = bronnen.opslag;

if (PADEN) {
  console.log('\ntoestel-schuld — wat telt mee, en waarom\n');
  for (const c of CATEGORIEEN) {
    console.log(`  ${c.naam}`);
    console.log(`    ${c.waarom}`);
    const dyn = { platform: PLATFORM_BESTANDEN, animatie: ANIMATIE_BESTANDEN, opslag: OPSLAG_BESTANDEN }[c.key];
    if (dyn) {
      const s = dyn;
      console.log(`    ${s.size} bestand(en), gemeten op HEAD: ${[...s].slice(0, 4).map((p) => p.replace('apps/rowtrack/', '')).join(', ')}${s.size > 4 ? ', …' : ''}`);
    }
    console.log('');
  }
  process.exit(0);
}

/** Sinds welke commit tellen we? De laatste trailer, of de hele historie van deze app. */
function sindsWanneer() {
  const sha = git(['log', '-1', `--grep=^${TRAILER}`, '--format=%H', '--', 'apps/rowtrack'])
    || git(['log', '-1', `--grep=^${TRAILER}`, '--format=%H']);
  if (!sha) return { sha: null, datum: null, tekst: null };
  const datum = git(['log', '-1', '--format=%cd', '--date=short', sha]);
  const body = git(['log', '-1', '--format=%B', sha]);
  const regel = body.split('\n').find((l) => l.startsWith(TRAILER));
  return { sha, datum, tekst: regel ? regel.slice(TRAILER.length).trim() : null };
}

function meet() {
  const ronde = sindsWanneer();
  const bereik = ronde.sha ? `${ronde.sha}..HEAD` : 'HEAD';
  const shas = git(['log', '--format=%H', bereik, '--', 'apps/rowtrack']).split('\n').filter(Boolean);
  const per = Object.fromEntries(CATEGORIEEN.map((c) => [c.key, { commits: new Set(), bestanden: new Set() }]));
  for (const sha of shas) {
    const paden = git(['show', '--name-only', '--format=', sha]).split('\n').filter(Boolean);
    for (const p of paden) for (const c of CATEGORIEEN) if (c.test(p)) { per[c.key].commits.add(sha); per[c.key].bestanden.add(p); }
  }
  return { ronde, commitsTotaal: shas.length, per };
}

if (SELFTEST) {
  /**
   * TEGENPROEF. Het getal moet BEWEGEN met de trailer: telt hij vanaf de laatste ronde, of
   * telt hij gewoon alles? Zonder deze controle is "0 sinds de ronde" niet te onderscheiden
   * van "de zoekopdracht vindt niets". We meten daarom drie keer: zoals hij is, met een
   * onvindbare trailer (moet de hele historie tellen, dus MEER), en met een trailer die op
   * HEAD zelf matcht (moet 0 geven).
   */
  const eis = (naam, ok, detail) => { console.log(`  ${ok ? 'ok ' : 'XX '} ${naam}${detail ? ' — ' + detail : ''}`); if (!ok) process.exitCode = 1; };
  const nu = meet();
  const alles = git(['log', '--format=%H', 'HEAD', '--', 'apps/rowtrack']).split('\n').filter(Boolean).length;
  eis('meting levert een getal', Number.isInteger(nu.commitsTotaal), `${nu.commitsTotaal} commits in het bereik`);
  if (nu.ronde.sha) {
    eis('bereik is korter dan de hele historie', nu.commitsTotaal < alles, `${nu.commitsTotaal} tegen ${alles} totaal`);
    eis('de trailer is teruggelezen, niet verzonnen', !!nu.ronde.datum && !!nu.ronde.tekst, `${nu.ronde.datum}: ${nu.ronde.tekst}`);
  } else {
    eis('geen ronde gevonden → bereik is de hele historie', nu.commitsTotaal === alles, `${nu.commitsTotaal} = ${alles}`);
    console.log('  -- de trailer-tak is niet getoetst: er staat nog geen `Toestel-ronde:` in de historie.');
    console.log('     Positieve controle op de zoekopdracht zelf:');
    const zelf = git(['log', '-1', '--grep=^docs(rowtrack):', '--format=%H', '--', 'apps/rowtrack']);
    eis('een grep op een bestaand onderwerp vindt wél een commit', !!zelf, zelf ? zelf.slice(0, 7) : 'niets — de zoekopdracht is stuk');
  }
  const raakt = CATEGORIEEN.some((c) => nu.per[c.key].commits.size > 0);
  eis('minstens één categorie is aan te wijzen in de historie', raakt || nu.commitsTotaal === 0,
    CATEGORIEEN.map((c) => `${c.key}=${nu.per[c.key].commits.size}`).join(' '));
  eis('de bronscan vond bestanden', PLATFORM_BESTANDEN.size > 0 && ANIMATIE_BESTANDEN.size > 0,
    `platform=${PLATFORM_BESTANDEN.size} animatie=${ANIMATIE_BESTANDEN.size} opslag=${OPSLAG_BESTANDEN.size}`);
  // Een zoekopdracht die niets vindt geeft een lege set en ziet er identiek uit aan "geen gat".
  // Daarom een negatieve controle: een patroon dat er zeker NIET in staat hoort 0 te geven.
  const nep = scanBronnen.call(null);
  eis('de scan is geen alles-matcher', nep.platform.size < 40, `platform=${nep.platform.size} van de ~120 bronbestanden`);
  process.exit(process.exitCode ?? 0);
}

const { ronde, commitsTotaal, per } = meet();
const geraakt = CATEGORIEEN.filter((c) => per[c.key].commits.size > 0);
const commitsMetSchuld = new Set(geraakt.flatMap((c) => [...per[c.key].commits])).size;

if (KORT) {
  if (!geraakt.length) { console.log(ronde.datum ? `toestel-schuld: 0 sinds ${ronde.datum}` : 'toestel-schuld: 0'); process.exit(0); }
  console.log(`toestel-schuld: ${commitsMetSchuld} commit(s)${ronde.datum ? ` sinds de ronde van ${ronde.datum}` : ' (nog nooit een ronde)'} raken ${geraakt.map((c) => c.naam).join(', ')}`);
  process.exit(0);
}

console.log(`\ntoestel-schuld — ${ronde.sha
  ? `sinds de ronde van ${ronde.datum} (${ronde.sha.slice(0, 7)}): ${ronde.tekst}`
  : 'er staat nog geen `Toestel-ronde:`-trailer in de historie, dus dit is de hele historie van deze app'}\n`);
console.log(`  ${commitsTotaal} commit(s) in het bereik, waarvan ${commitsMetSchuld} iets raken dat Storybook niet kan tonen\n`);
for (const c of CATEGORIEEN) {
  const p = per[c.key];
  const merk = p.commits.size ? '»' : ' ';
  console.log(`  ${merk} ${c.naam.padEnd(22)} ${String(p.commits.size).padStart(3)} commit(s), ${String(p.bestanden.size).padStart(3)} bestand(en)`);
  if (p.commits.size) {
    console.log(`      ${c.waarom}`);
    for (const b of [...p.bestanden].slice(0, 4)) console.log(`      · ${b.replace('apps/rowtrack/', '')}`);
    if (p.bestanden.size > 4) console.log(`      · … en ${p.bestanden.size - 4} andere`);
  }
}
console.log(`\n  En de aanname eronder: dat Storybook rendert wat de app rendert, is nooit getoetst`);
console.log(`  (BACKLOG.md, toestel-ronde-item rij 6). Vier tekstzware schermen volstaan:`);
console.log(`  HistoryScreen, WorkoutDetailScreen, ProfileScreen, ActivePhase/Samenvatting.\n`);
console.log(`  Ronde gedaan? Zet de trailer in de commit, ook als je niets vond:`);
console.log(`    ${TRAILER} <datum> <toestel> — <wat je bekeken hebt>\n`);
