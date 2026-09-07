#!/usr/bin/env node
/**
 * refs-check.mjs — toetst of elke PR-verwijzing in de markdown van deze repo bestaat,
 * en of ze zegt uit welke repo ze komt.
 *
 * Waarom dit niet in de pre-commit hook kan: een hook heeft geen netwerk en kan een écht
 * PR-nummer dus niet onderscheiden van een plausibel nummer. De hook waarschuwt over de
 * vórm (een kaal `#N` in de gedeelde laag); deze check toetst het bestáán. Gemeten geval
 * dat hem opende (2026-09-07): `umanex-apps PR #370` werd in een BACKLOG-entry geschreven
 * vóór `gh pr create` had gesproken; het werd #372.
 *
 * Twee assen:
 *   [naamruimte]  een kaal `#N` in de gedeelde laag — die tekst reist naar elke klant-repo,
 *                 waar hetzelfde nummer een andere PR is. Gemeten: 19 van 19 verwijzingen
 *                 in umanex-os bestonden óók in umanex-apps.
 *   [bestaan]     een gekwalificeerde `repo#N` die GitHub niet kent.
 *
 * Bewust NIET: commit-SHA's tegen `git cat-file` houden. Gemeten op umanex-apps: van de
 * vijftien hex-tokens in de lussen zijn er twee Supabase workout-UUID's, dus die check
 * zou vals alarm slaan. Pas zinvol als hij zich beperkt tot tokens naast "commit"/"merge".
 *
 * Gebruik:  node scripts/refs-check.mjs [--owner=umanex] [--selftest]
 * Exit 1 bij een bevinding, én bij "kan niet meten" — een checker die GitHub niet bereikt
 * mag niet groen rapporteren, anders ziet een kapot instrument eruit als een schone repo.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split('=')[1];
const OWNER = arg('owner', 'umanex');
const SELFTEST = process.argv.includes('--selftest');

/**
 * Een kaal `#N`: niet voorafgegaan door een woordteken, `/`, `#` of `-`, en niet gevolgd door
 * een cijfer of letter — zo vallen #123456 en #1a2b3c (hex) buiten bereik.
 *
 * TWEE tot vier cijfers, en niet beginnend met een 0. Een PR-nummer begint nooit met
 * een nul, een hex-kleur vaak wel: `#000@30%` in een rowtrack-briefing werd anders
 * gelezen als nummer 0 en gemeld als niet-bestaand. Gemeten op 2026-09-07: het laagste PR-nummer dat in deze
 * repo's ooit aangehaald wordt is #19, en de enige enkelcijferige treffers in de gedeelde
 * laag zijn rangtelwoorden ("de #1 eerste zet" in de sessie-reflectie-skill). Eén cijfer
 * toelaten maakt de guard een wolf-roeper op precies de plek waar hij gelezen moet worden.
 */
const KAAL = /(^|[^A-Za-z0-9_/#-])#([1-9]\d{1,3})(?![0-9A-Za-z])/g;
/**
 * `repo#N` of `owner/repo#N`. De naam moet op een letter of cijfer eindigen: zonder die
 * eis las `acceptatie-#5` in een rowtrack-briefing als repo "acceptatie-" met nummer 5.
 */
const GEKWALIFICEERD = /(?:^|[^A-Za-z0-9_/-])((?:[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]*[A-Za-z0-9])#([1-9]\d{0,4})(?![0-9A-Za-z])/g;

/**
 * In welke bestanden is een kaal nummer een harde fout? Precies de tekst die meereist.
 *
 * Bewust ENGER dan de pre-commit hook. Die waarschuwt in umanex-os op elke `.md`, maar
 * alleen op regels die je nú toevoegt — voorwaartse druk, legacy blijft stil. Deze check
 * leest het hele bestand, dus dezelfde scope zou meteen 75 historische regels rood maken
 * in BACKLOG/HANDOFF/LEARNINGS. Die drie reizen niet mee (de sync seedt ze, overschrijft
 * ze nooit), dus daar is een kaal nummer hoogstens verwarrend, niet fout in een andere repo.
 * Wat wél reist: CLAUDE.md, profiles/ en de skills.
 */
function inGedeeldeLaag(pad) {
  if (existsSync('templates/githooks-pre-commit')) {                             // umanex-os zelf
    return pad === 'CLAUDE.md' || pad.startsWith('profiles/') || pad.startsWith('.claude/skills/');
  }
  return pad.startsWith('.umanex-os/') || pad.startsWith('.claude/skills/');     // klant-repo
}

/** Haal beide soorten verwijzingen uit één bestand. */
export function ontleed(tekst) {
  const zonderCode = tekst.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, m => ' '.repeat(m.length));
  const kaal = [...zonderCode.matchAll(KAAL)].map(m => Number(m[2]));
  const gekwalificeerd = [...zonderCode.matchAll(GEKWALIFICEERD)].map(m => ({
    repo: m[1].includes('/') ? m[1] : `${OWNER}/${m[1]}`, nummer: Number(m[2]),
  }));
  return { kaal, gekwalificeerd };
}

/** De repo waar we in staan, uit de origin-remote: `umanex/umanex-apps`. */
function huidigeRepo() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    const m = url.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
    return m ? `${m[1]}/${m[2]}` : null;
  } catch { return null; }
}

/**
 * Welke soort fout gaf gh terug? Apart en puur, zodat de drie takken offline te toetsen
 * zijn — een 403 valt in CI niet op commando op te wekken.
 */
export function classificeer(err) {
  if (/HTTP 404|Not Found/i.test(err)) return 'niet-gevonden';
  if (/HTTP 403/.test(err)) return 'geen-toegang';
  return 'instrument-stuk';
}

const cache = new Map();
const repoZichtbaar = new Map();
let netwerkStuk = null;
const geenToegang = [];

/**
 * Ziet dit token de repo überhaupt? Dit is de positieve controle onder de 404.
 *
 * GEMETEN in CI op 2026-09-07: GitHub antwoordt op een privé-repo waar je token niet bij
 * mag met **404**, niet met 403 — dat is expres, anders zou het bestaan van privé-repo's
 * lekken. "Bestaat niet" en "mag ik niet zien" zijn dus hetzelfde antwoord. Zonder deze
 * controle rapporteerde de checker vijf bestaande umanex-os-PR's als niet-bestaand, omdat
 * CLIENT_DISPATCH_TOKEN wél bij de klant-repo's mag en niet bij umanex-os zelf.
 *
 * Laat het instrument het object dus eerst terugvinden vóór je een eigenschap ervan afleest.
 */
function zietRepo(repo) {
  if (repoZichtbaar.has(repo)) return repoZichtbaar.get(repo);
  let uit;
  try {
    execFileSync('gh', ['api', `repos/${repo}`, '--jq', '.full_name'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    uit = true;
  } catch (e) {
    const err = (e.stderr ?? '') + (e.stdout ?? '');
    uit = classificeer(err) === 'instrument-stuk' ? null : false;
    if (uit === null) netwerkStuk = `repos/${repo}: ${err.trim().split('\n')[0] || String(e.message)}`;
  }
  repoZichtbaar.set(repo, uit);
  return uit;
}
/**
 * Bestaat deze PR (of issue — GitHub deelt de teller)?
 *   true  = ja · false = nee (404) · 'geen-toegang' = 403 · null = instrument stuk
 *
 * 403 en 401 zijn niet hetzelfde. 403 betekent dat het token deze privé-repo niet mág
 * lezen: een grens, geen defect in de tekst — die verwijzing wordt zichtbaar overgeslagen
 * en geteld. 401 of een netwerkfout betekent dat het instrument niet werkt, en dan mag er
 * geen groen rapport uit komen.
 */
function bestaat(repo, nummer) {
  const sleutel = `${repo}#${nummer}`;
  if (cache.has(sleutel)) return cache.get(sleutel);
  let uit;
  try {
    execFileSync('gh', ['api', `repos/${repo}/issues/${nummer}`, '--jq', '.number'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    uit = true;
  } catch (e) {
    const err = (e.stderr ?? '') + (e.stdout ?? '');
    // 404 is een antwoord; alles anders (geen gh, geen token, geen netwerk) is géén meting.
    switch (classificeer(err)) {
      // Een 404 betekent "bestaat niet" óf "mag ik niet zien". Alleen als het token de
      // repo aantoonbaar wél ziet, is het eerste een geldige conclusie.
      case 'niet-gevonden': {
        const zicht = zietRepo(repo);
        if (zicht === true) uit = false;
        else if (zicht === false) { geenToegang.push(sleutel); uit = 'geen-toegang'; }
        else uit = null;
        break;
      }
      case 'geen-toegang': geenToegang.push(sleutel); uit = 'geen-toegang'; break;
      default: netwerkStuk = `${sleutel}: ${err.trim().split('\n')[0] || String(e.message)}`; uit = null;
    }
  }
  cache.set(sleutel, uit);
  return uit;
}

// ── zelftest ─────────────────────────────────────────────────────────────────
if (SELFTEST) {
  let gezakt = 0;
  const eis = (naam, waar) => { console.log(`${waar ? '✓' : '✗'} ${naam}`); if (!waar) gezakt++; };

  const a = ontleed('Zie PR #372 en umanex-apps#380 en umanex/umanex-os#173.');
  eis('kaal nummer herkend', a.kaal.length === 1 && a.kaal[0] === 372);
  eis('gekwalificeerd herkend, repo ingevuld',
    a.gekwalificeerd.length === 2 &&
    a.gekwalificeerd[0].repo === 'umanex/umanex-apps' && a.gekwalificeerd[0].nummer === 380 &&
    a.gekwalificeerd[1].repo === 'umanex/umanex-os' && a.gekwalificeerd[1].nummer === 173);

  const b = ontleed('Kleuren #123456 en #1a2b3c, kop ## 2026-09-07, en `#999` in code.');
  eis('hex, kop en code-span geven geen treffer', b.kaal.length === 0);

  const c = ontleed('```\nPR #111\n```\nbuiten het blok: niets');
  eis('codeblok telt niet mee', c.kaal.length === 0);

  const d = ontleed('Wat is de #1 eerste zet? En de #9 daarna?');
  eis('enkelcijferig rangtelwoord is geen PR-verwijzing', d.kaal.length === 0);

  const e = ontleed('drop shadow #000@30% en #012 en #0');
  eis('een nummer met leidende nul is een kleur, geen PR', e.kaal.length === 0 && e.gekwalificeerd.length === 0);

  const f = ontleed('acceptatie-#5 en item-#12 blijven buiten beeld');
  eis('naam die op een koppelteken eindigt is geen repo', f.gekwalificeerd.length === 0);

  // De drie foutsoorten, offline. Een 403 valt in CI niet op commando op te wekken, dus
  // zonder deze cases zou de tak die hem van een 401 onderscheidt nooit getoetst zijn.
  eis('404 leest als niet-gevonden', classificeer('gh: Not Found (HTTP 404)') === 'niet-gevonden');
  eis('403 leest als geen-toegang',
    classificeer('gh: Resource not accessible by integration (HTTP 403)') === 'geen-toegang');
  eis('401 leest als instrument-stuk', classificeer('gh: Bad credentials (HTTP 401)') === 'instrument-stuk');
  eis('een netwerkfout leest als instrument-stuk',
    classificeer('dial tcp: lookup api.github.com: no such host') === 'instrument-stuk');

  // De positieve controle onder de 404: een repo die het token niet ziet, mag geen
  // "bestaat niet" opleveren. Getoetst op een repo die zeker niet leesbaar is.
  const onzichtbaar = zietRepo('umanex/repo-die-niet-bestaat-9f3a');
  eis('een onzichtbare repo wordt als onzichtbaar herkend', onzichtbaar === false);
  eis('umanex-os is zichtbaar voor dit token', zietRepo(`${OWNER}/umanex-apps`) === true);

  // Netwerk-as, beide kanten. Zonder netwerk is dit geen groene test maar een gat.
  const echt = bestaat(`${OWNER}/umanex-apps`, 369);
  const verzonnen = bestaat(`${OWNER}/umanex-apps`, 999999);
  if (echt === null || verzonnen === null) {
    console.log(`✗ netwerk-as: [NIET TE VERIFIEERBAAR — ${netwerkStuk}]`);
    gezakt++;
  } else {
    eis('bestaande PR wordt gevonden', echt === true);
    eis('verzonnen nummer wordt afgekeurd', verzonnen === false);
  }
  console.log(gezakt ? `\n✗ zelftest: ${gezakt} gezakt.` : '\n✓ zelftest: de checker meet beide kanten.');
  process.exit(gezakt ? 1 : 0);
}

// ── de run ───────────────────────────────────────────────────────────────────
const bestanden = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
  .split('\n').filter(p => p && !p.includes('node_modules/'));

const EIGEN = huidigeRepo();
const bevindingen = [];
let getoetst = 0;   // aantal gekwalificeerde verwijzingen dat écht aan GitHub gevraagd is
for (const pad of bestanden) {
  const { kaal, gekwalificeerd } = ontleed(readFileSync(pad, 'utf8'));
  for (const n of [...new Set(kaal)]) {
    if (inGedeeldeLaag(pad)) {
      // Deze tekst reist: een kaal nummer is hier hoe dan ook fout, ook als het bestaat.
      bevindingen.push({ as: '[naamruimte]', pad, tekst: `\`#${n}\` zonder repo — deze tekst reist mee.`,
        herstel: `Schrijf \`umanex-apps#${n}\` of \`umanex-os#${n}\`.` });
    } else if (EIGEN) {
      // Blijft lokaal, dus kaal mag — maar het nummer moet wél bestaan in déze repo.
      const r = bestaat(EIGEN, n);
      if (r === true || r === false) getoetst++;
      if (r === false) {
        bevindingen.push({ as: '[bestaan]', pad, tekst: `\`#${n}\` bestaat niet in ${EIGEN}.`,
          herstel: 'Lees het nummer terug uit de tool die het uitgaf; voorspel het niet.' });
      }
    }
  }
  for (const { repo, nummer } of gekwalificeerd) {
    const r = bestaat(repo, nummer);
    if (r === true || r === false) getoetst++;
    if (r === false) {
      bevindingen.push({ as: '[bestaan]', pad, tekst: `\`${repo}#${nummer}\` bestaat niet op GitHub.`,
        herstel: 'Lees het nummer terug uit de tool die het uitgaf; voorspel het niet.' });
    }
  }
}

// Alles overgeslagen betekent dat het instrument niets gemeten heeft, hoe beleefd de
// foutcode ook was. Dat is een instrumentfout, geen schone repo.
if (!netwerkStuk && getoetst === 0 && geenToegang.length) {
  netwerkStuk = `geen enkele verwijzing kon getoetst worden — ${geenToegang.length}× 403`;
}

if (netwerkStuk) {
  console.error(`✗ refs-check kon GitHub niet bereiken: ${netwerkStuk}`);
  console.error('  Een checker die niet meet mag niet groen rapporteren.');
  console.error('  403 op een privé-repo betekent dat het token er niet bij mag: in CI hoort hier');
  console.error('  een cross-repo PAT te staan (umanex-os gebruikt CLIENT_DISPATCH_TOKEN), niet de');
  console.error('  standaard GITHUB_TOKEN — die ziet alleen de eigen repo plus wat publiek is.');
  process.exit(1);
}

if (geenToegang.length) {
  console.log(`— ${geenToegang.length} verwijzing(en) overgeslagen, token heeft geen toegang: ${[...new Set(geenToegang)].join(', ')}`);
}

if (!bevindingen.length) {
  // Het aantal erbij, want "alles bestaat" en "er was niets" zien er anders identiek uit.
  console.log(`✓ refs-check: ${bestanden.length} markdown-bestanden, ${getoetst} verwijzing(en) getoetst tegen GitHub, alle gekwalificeerd en bestaand.`);
  process.exit(0);
}
console.error(`✗ refs-check — ${bevindingen.length} bevinding(en):\n`);
for (const b of bevindingen) {
  console.error(`  ${b.as} ${b.pad}: ${b.tekst}`);
  console.error(`      → ${b.herstel}`);
}
process.exit(1);
