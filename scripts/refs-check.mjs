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
export function inGedeeldeLaag(pad, isUmanexOs = () => existsSync('templates/githooks-pre-commit')) {
  // De probe is injecteerbaar zodat de zelftest béide repo-vormen kan draaien. Zonder dat
  // was deze tak alleen te raken door in de andere repo te gaan staan — en juist hier zat
  // op 2026-09-07 een fix ("naamruimte-scope gelijk aan wat de sync werkelijk kopieert").
  if (isUmanexOs()) {                                                            // umanex-os zelf
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
  // mutatie-uitzondering: memoisatie — neutraliseren herberekent en geeft dezelfde uitkomst.
  if (repoZichtbaar.has(repo)) return repoZichtbaar.get(repo);
  let uit;
  try {
    execFileSync('gh', ['api', `repos/${repo}`, '--jq', '.full_name'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    uit = true;
  } catch (e) {
    const err = (e.stderr ?? '') + (e.stdout ?? '');
    uit = classificeer(err) === 'instrument-stuk' ? null : false;
    // mutatie-uitzondering: alleen te raken met een kapotte `gh` — offline niet op te wekken.
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
/**
 * Wat betekent een 404, gegeven wat het token van de repo ziet? Als eigen functie omdat de
 * netwerk-arm van de zelftest overgeslagen wordt zonder token: stond deze beslissing ín
 * `bestaat`, dan hing haar dekking aan de aanwezigheid van een secret. GEMETEN in CI-run
 * umanex-os#187: 14/14 lokaal (mét token) tegen 13/14 in CI — een dekkingscijfer dat met de
 * omgeving meebeweegt meet de omgeving, niet de test.
 *   true  → de repo is zichtbaar, dus 404 betekent écht "bestaat niet"
 *   false → de repo is onzichtbaar, dus 404 betekent "mag ik niet zien"
 *   null  → het instrument werkt niet; geen conclusie
 */
export function naVierNulVier(zicht) {
  if (zicht === true) return false;
  if (zicht === false) return 'geen-toegang';
  return null;
}

function bestaat(repo, nummer) {
  const sleutel = `${repo}#${nummer}`;
  // mutatie-uitzondering: memoisatie — neutraliseren herberekent en geeft dezelfde uitkomst.
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
        uit = naVierNulVier(zietRepo(repo));
        // mutatie-uitzondering: side-effect op een pad dat alleen met een echt 404-op-onzichtbare-repo bestaat; de beslissing zelf is offline getoetst via naVierNulVier(), en de `case 'geen-toegang'`-arm ernaast draagt dezelfde push buiten bereik van de scanner.
        if (uit === 'geen-toegang') geenToegang.push(sleutel);
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

  // De netwerk-arm draait alleen met een bruikbaar token. Eerst één probe, en het
  // onderscheid dat deze checker zelf predikt: "geen token" is iets anders dan "het
  // netwerk is stuk". GEMETEN 2026-09-08 (CI-run umanex-os#187): zonder `GH_TOKEN` gaf
  // `zietRepo` null en vielen de twee assertions eronder om — waardoor de zelftest
  // onbruikbaar was in élke stap die dat secret niet zet, zoals de mutatie-dekking. Een
  // overgeslagen arm moet zichtbaar zijn, niet dodelijk: de offline assertions hierboven
  // en hieronder zijn het leeuwendeel en meten wél.
  const probe = zietRepo(`${OWNER}/umanex-apps`);
  // mutatie-uitzondering: poort op de aanwezigheid van een token — de hermetische suite kan die niet variëren, en beide kanten zijn los getoetst (gh-stub met 401 → overgeslagen, echte gh → arm draait).
  if (probe === null) {
    console.log(`— netwerk-as overgeslagen: geen bruikbaar GH-token (${netwerkStuk || 'gh niet beschikbaar'})`);
    netwerkStuk = null;   // de overslag is gemeld; hij mag de run hierna niet rood maken
  } else {
    eis('umanex-apps is zichtbaar voor dit token', probe === true);
    // De positieve controle onder de 404: een repo die het token niet ziet, mag geen
    // "bestaat niet" opleveren. Getoetst op een repo die zeker niet leesbaar is.
    eis('een onzichtbare repo wordt als onzichtbaar herkend',
      zietRepo('umanex/repo-die-niet-bestaat-9f3a') === false);

    // Netwerk-as, beide kanten. Mét token is een null hier wél een gat.
    const echt = bestaat(`${OWNER}/umanex-apps`, 369);
    const verzonnen = bestaat(`${OWNER}/umanex-apps`, 999999);
    // mutatie-uitzondering: poort op de netwerk-arm zelf; mét werkend token gedragsneutraal.
    if (echt === null || verzonnen === null) {
      console.log(`✗ netwerk-as: [NIET TE VERIFIEERBAAR — ${netwerkStuk}]`);
      gezakt++;
    } else {
      eis('bestaande PR wordt gevonden', echt === true);
      eis('verzonnen nummer wordt afgekeurd', verzonnen === false);
    }
  }

  // ── de 404-beslissing, offline op alle drie de kanten ─────────────────────
  eis('404 op een zichtbare repo betekent "bestaat niet"', naVierNulVier(true) === false);
  eis('404 op een onzichtbare repo betekent "geen toegang"', naVierNulVier(false) === 'geen-toegang');
  eis('404 met een kapot instrument geeft geen conclusie', naVierNulVier(null) === null);

  // ── scope: béide repo-vormen, via de injecteerbare probe ──────────────────
  const alsOs = p => inGedeeldeLaag(p, () => true);
  const alsKlant = p => inGedeeldeLaag(p, () => false);
  eis('umanex-os: CLAUDE.md reist mee', alsOs('CLAUDE.md') === true);
  eis('umanex-os: profiles/ en skills reizen mee',
    alsOs('profiles/umanex.md') === true && alsOs('.claude/skills/verify/SKILL.md') === true);
  eis('umanex-os: BACKLOG reist NIET mee', alsOs('BACKLOG.md') === false);
  eis('klant: .umanex-os/ reist mee', alsKlant('.umanex-os/CLAUDE.md') === true);
  eis('klant: eigen CLAUDE.md reist NIET mee', alsKlant('CLAUDE.md') === false);

  // ── scan: de drie takken, met een verzonnen bestandsstelsel en een stub-bestaat ──
  const stubBestaat = (repo, n) => (n === 404 ? false : n === 403 ? 'geen-toegang' : true);
  const s1 = scan({
    bestanden: ['CLAUDE.md'], lees: () => 'zie #372 hier', eigen: 'umanex/umanex-os',
    bestaatFn: stubBestaat, inLaag: alsOs,
  });
  eis('kaal nummer in de gedeelde laag geeft een naamruimte-bevinding',
    s1.bevindingen.length === 1 && s1.bevindingen[0].as === '[naamruimte]' && s1.getoetst === 0);

  const s2 = scan({
    // #77 en niet #7: enkelcijferig is per definitie een rangtelwoord en wordt niet ontleed.
    bestanden: ['BACKLOG.md'], lees: () => 'zie #404 en #77', eigen: 'umanex/umanex-os',
    bestaatFn: stubBestaat, inLaag: alsOs,
  });
  eis('kaal nummer buiten de laag wordt op bestaan getoetst',
    s2.getoetst === 2 && s2.bevindingen.length === 1 && s2.bevindingen[0].as === '[bestaan]');

  const s3 = scan({
    bestanden: ['x.md'], lees: () => 'umanex-apps#404 en umanex-os#12', eigen: null,
    bestaatFn: stubBestaat, inLaag: alsOs,
  });
  eis('gekwalificeerde verwijzing die niet bestaat wordt gemeld',
    s3.getoetst === 2 && s3.bevindingen.length === 1 && /umanex-apps#404/.test(s3.bevindingen[0].tekst));

  const s4 = scan({
    bestanden: ['x.md'], lees: () => 'geen enkele verwijzing hier', eigen: 'umanex/umanex-os',
    bestaatFn: stubBestaat, inLaag: alsOs,
  });
  eis('bestand zonder verwijzingen levert niets op',
    s4.bevindingen.length === 0 && s4.getoetst === 0);

  // Zonder eigen repo mag een kaal nummer buiten de laag niet stilletjes getoetst worden.
  const s5 = scan({
    bestanden: ['BACKLOG.md'], lees: () => 'zie #404', eigen: null,
    bestaatFn: stubBestaat, inLaag: alsOs,
  });
  eis('kaal nummer zonder eigen repo wordt overgeslagen',
    s5.bevindingen.length === 0 && s5.getoetst === 0);

  // ── rapporteer: alle vier de uitgangen, zonder iets af te drukken ─────────
  const stil = () => {};
  const rap = o => rapporteer({ netwerkStuk: null, getoetst: 5, geenToegang: [], bevindingen: [],
                                aantalBestanden: 3, log: stil, err: stil, ...o });
  eis('schone run geeft 0', rap({}) === 0);
  eis('bevindingen geven 1', rap({ bevindingen: [{ as: '[x]', pad: 'a', tekst: 't', herstel: 'h' }] }) === 1);
  eis('netwerk stuk geeft 1', rap({ netwerkStuk: 'geen gh' }) === 1);
  eis('overgeslagen verwijzingen blijven groen zolang er wél gemeten is',
    rap({ geenToegang: ['a#1'], getoetst: 5 }) === 0);
  // Deze tak verandert de exit-code niet, alleen de uitvoer — dus toetsen we de uitvoer.
  // Zonder deze case bleef hij ongedekt (scripts/test-mutatie-dekking.sh, 2026-09-08).
  {
    const uitRegels = [];
    const code = rapporteer({ netwerkStuk: null, getoetst: 5, geenToegang: ['a#1', 'a#1', 'b#2'],
      bevindingen: [], aantalBestanden: 3, log: m => uitRegels.push(String(m)), err: stil });
    const tekst = uitRegels.join('\n');
    eis('overgeslagen verwijzingen worden gemeld, ontdubbeld',
      code === 0 && /overgeslagen/.test(tekst) && /a#1/.test(tekst) && /b#2/.test(tekst)
      && (tekst.match(/a#1/g) || []).length === 1);
  }
  // De afleiding die "beleefd overgeslagen" van "niets gemeten" onderscheidt.
  eis('nul gemeten plus 403 leest als instrument stuk',
    rap({ geenToegang: ['a#1'], getoetst: 0 }) === 1);

  console.log(gezakt ? `\n✗ zelftest: ${gezakt} gezakt.` : '\n✓ zelftest: de checker meet beide kanten.');
  process.exit(gezakt ? 1 : 0);
}

// ── scan en rapportage, als functies zodat de zelftest ze offline kan aandrijven ────
//
// Waarom dit functies zijn en geen rechtlijnige top-level code: `scripts/test-mutatie-dekking.sh`
// wees op 2026-09-08 vijftien beslistakken hier aan als ongedekt — de hele scan- en
// rapportagekant. Die takken zijn precies waar de fouten van 2026-09-07 zaten (een 404 die
// "mag ik niet zien" betekende, een scope die niet klopte). Met injecteerbare bronnen
// draait de zelftest ze zonder netwerk en zonder repo.

/** Doorloop de bestanden en verzamel bevindingen. Alle bronnen injecteerbaar. */
export function scan({ bestanden, lees, eigen, bestaatFn, inLaag = inGedeeldeLaag }) {
  const bevindingen = [];
  let getoetst = 0;
  for (const pad of bestanden) {
    const { kaal, gekwalificeerd } = ontleed(lees(pad));
    for (const n of [...new Set(kaal)]) {
      if (inLaag(pad)) {
        // Deze tekst reist: een kaal nummer is hier hoe dan ook fout, ook als het bestaat.
        bevindingen.push({ as: '[naamruimte]', pad, tekst: `\`#${n}\` zonder repo — deze tekst reist mee.`,
          herstel: `Schrijf \`umanex-apps#${n}\` of \`umanex-os#${n}\`.` });
      } else if (eigen) {
        // Blijft lokaal, dus kaal mag — maar het nummer moet wél bestaan in déze repo.
        const r = bestaatFn(eigen, n);
        if (r === true || r === false) getoetst++;
        if (r === false) {
          bevindingen.push({ as: '[bestaan]', pad, tekst: `\`#${n}\` bestaat niet in ${eigen}.`,
            herstel: 'Lees het nummer terug uit de tool die het uitgaf; voorspel het niet.' });
        }
      }
    }
    for (const { repo, nummer } of gekwalificeerd) {
      const r = bestaatFn(repo, nummer);
      if (r === true || r === false) getoetst++;
      if (r === false) {
        bevindingen.push({ as: '[bestaan]', pad, tekst: `\`${repo}#${nummer}\` bestaat niet op GitHub.`,
          herstel: 'Lees het nummer terug uit de tool die het uitgaf; voorspel het niet.' });
      }
    }
  }
  return { bevindingen, getoetst };
}

/** Beslis wat er gerapporteerd wordt. Geeft de exit-code terug in plaats van te exiten. */
export function rapporteer({ netwerkStuk: stuk, getoetst, geenToegang: over, bevindingen,
                             aantalBestanden, log = console.log, err = console.error }) {
  // Alles overgeslagen betekent dat het instrument niets gemeten heeft, hoe beleefd de
  // foutcode ook was. Dat is een instrumentfout, geen schone repo.
  if (!stuk && getoetst === 0 && over.length) {
    stuk = `geen enkele verwijzing kon getoetst worden — ${over.length}× 403`;
  }
  if (stuk) {
    err(`✗ refs-check kon GitHub niet bereiken: ${stuk}`);
    err('  Een checker die niet meet mag niet groen rapporteren.');
    err('  403 op een privé-repo betekent dat het token er niet bij mag: in CI hoort hier');
    err('  een cross-repo PAT te staan (umanex-os gebruikt CLIENT_DISPATCH_TOKEN), niet de');
    err('  standaard GITHUB_TOKEN — die ziet alleen de eigen repo plus wat publiek is.');
    return 1;
  }
  if (over.length) {
    log(`— ${over.length} verwijzing(en) overgeslagen, token heeft geen toegang: ${[...new Set(over)].join(', ')}`);
  }
  if (!bevindingen.length) {
    // Het aantal erbij, want "alles bestaat" en "er was niets" zien er anders identiek uit.
    log(`✓ refs-check: ${aantalBestanden} markdown-bestanden, ${getoetst} verwijzing(en) getoetst tegen GitHub, alle gekwalificeerd en bestaand.`);
    return 0;
  }
  err(`✗ refs-check — ${bevindingen.length} bevinding(en):\n`);
  for (const b of bevindingen) {
    err(`  ${b.as} ${b.pad}: ${b.tekst}`);
    err(`      → ${b.herstel}`);
  }
  return 1;
}

// Valt de SELFTEST-poort hierboven weg, dan zou `--selftest` stil de échte run doen en
// exit 0 geven — een zelftest die niet draait, ziet er dan uit als een geslaagde. Deze val
// maakt dat zichtbaar. (Gevonden door scripts/test-mutatie-dekking.sh op 2026-09-08.)
// mutatie-uitzondering: defensieve val — zolang de SELFTEST-poort hierboven werkt is deze
// tak per constructie onbereikbaar. Hij bestaat juist om díe poort meetbaar te maken.
if (SELFTEST) {
  console.error('✗ zelftest is niet gedraaid terwijl --selftest gevraagd was.');
  process.exit(1);
}

// ── de run ───────────────────────────────────────────────────────────────────
const bestanden = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
  .split('\n').filter(p => p && !p.includes('node_modules/'));

const { bevindingen, getoetst } = scan({
  bestanden, lees: pad => readFileSync(pad, 'utf8'), eigen: huidigeRepo(), bestaatFn: bestaat,
});
process.exit(rapporteer({ netwerkStuk, getoetst, geenToegang, bevindingen,
                          aantalBestanden: bestanden.length }));
