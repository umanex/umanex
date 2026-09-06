#!/usr/bin/env node
/**
 * Flow-harness: rijdt de app uit in een echte browser — driver B van de contrast-meting.
 *
 *   pnpm --filter cashflow flow             # alle scenario's
 *   pnpm --filter cashflow flow --selftest  # + de tegenproeven, die hóren te falen
 *   pnpm --filter cashflow flow --headed    # meekijken terwijl het gebeurt
 *   pnpm --filter cashflow flow --no-build  # hergebruik de vorige harness-build
 *   pnpm --filter cashflow flow --dist=.next # serveer een bestaande build, bouw niet (CI)
 *
 * Waarom dit bestaat: het slepen van een post tussen maanden viel tot 2026-08-07 buiten
 * élk vangnet. De scenario-scripts raken alleen de rekenkern, `@umanex/tokens contrast`
 * alleen de rollaag, en `dom-sweep.mjs` leest alleen statische bestanden — waar
 * `MonthCard` en de modals per definitie buiten vallen, want die hangen aan dnd-kit en
 * de store. Het grootste scherm van de app was dus alleen gelezen, nooit uitgereden — en
 * toen het één keer met de hand uitgereden werd, faalde het meteen.
 *
 * Wat hij dekt:
 *   - de sleep tussen twee maandkolommen, met toetsenbord én muis
 *   - de contrast-sweep op het échte scherm, mét beide modals open (dezelfde meting als
 *     `dom-sweep.mjs`, uit `contrast.mjs` — één bron, twee drivers)
 *   - het openen en sluiten van `RepeatMonthModal` en `ReservationPaymentModal`
 *   - loading, empty en error: de drie states die een gebruiker ziet wanneer het misgaat
 *
 * Waarom hij de échte app aanstuurt en niet een gemockte `MonthCard`: dnd-kit meet
 * rechthoeken op, en een sweep meet gecomponeerde kleuren. Een harness die de kolommen
 * zelf neerzet, meet zijn eigen layout — precies de as waarop dit gedrag stukgaat. Dit
 * rijdt op de gebouwde app, dezelfde bundel die `next start` serveert.
 *
 * Waarom hij tóch geen productiedata kan raken: élk verzoek naar de Supabase-origin wordt
 * onderschept. Wat de harness kent (login, het document, de snapshots, de wegschrijf-call)
 * beantwoordt hij uit een fixture; al het overige wordt afgebroken en geteld als lek — één
 * lek en de run faalt. Er gaat dus geen enkele byte naar `cashflow_state` van de echte
 * gebruiker, ook niet wanneer het slepen slaagt en de app wíl wegschrijven.
 *
 * Eigen build in een eigen map (`.next-harness`, via NEXT_DIST_DIR in next.config.mjs) en
 * een eigen server op een eigen poort (3100). De PM2-app op 3000 serveert `.next` uit
 * dezelfde tree — sinds app-werk in de hoofdtree gebeurt is dat de tree waarin je bouwt.
 * Die build mag deze harness niet overschrijven en die server niet herstarten. Daarom
 * bouwt hij nooit in `.next`; hij kan er hooguit een bestaande build uit serveren
 * (`--dist=.next`, wat CI doet met de build van de stap ervoor).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beoordeel, beschrijfFout, meetInPagina, STIL_CSS } from './contrast.mjs';
import { kiesDist } from './harness-dist.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const require_ = createRequire(import.meta.url);

const args = process.argv.slice(2);
const SELFTEST = args.includes('--selftest');
const HEADED = args.includes('--headed');
// Gezet door de signaalhandler in main(): een onderbroken run eindigt met 130/143, niet met 1.
let onderbroken = null;
const PORT = Number(args.find((a) => a.startsWith('--port='))?.slice(7) ?? 3100);
const BASE = `http://127.0.0.1:${PORT}`;

// ── Build-map ────────────────────────────────────────────────────────────────
// Twee namen, letterlijk, gekozen in `harness-dist.mjs`: `.next` is de live map (PM2 op
// :3000 leest eruit) en wordt alleen geserveerd; `.next-harness` is de eigen map en wordt
// gebouwd, tenzij `--no-build` de vorige build hergebruikt. Vrije invoer is een wisser —
// `next build` maakt de doelmap eerst leeg — dus een allowlist, geen normalisatie.
let gekozen;
try {
  gekozen = kiesDist(args);
} catch (err) {
  console.error(err.message);
  process.exit(2);
}
const { DIST, LIVE_MAP, BOUWEN } = gekozen;
const DIST_PAD = resolve(APP, DIST);

// ── Fixture ──────────────────────────────────────────────────────────────────
// Eén post in de eerste kolom, met een bedrag dat nergens anders voorkomt zodat de
// saldo-assertie hem niet met een andere waarde kan verwarren. Eén spaarpot erbij, want
// zonder pot bestaat de betaalmodal niet: die kiest uit de actieve potten.
const USER_ID = '00000000-0000-4000-8000-000000000001';
const LABEL = 'Harnaspost';
const AMOUNT = 137.42;
const POT = 'Harnaspot';

/** 'YYYY-MM' voor vandaag + n maanden. De app toont drie kolommen vanaf de huidige maand. */
function monthKey(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const BRON = monthKey(0);
const DOEL = monthKey(1);

/**
 * `leeg: true` geeft een geldig document zónder posten — dat is iets anders dan een
 * mislukte fetch, en het hoort ook iets anders te tonen: lege staten per sectie in
 * plaats van een foutscherm.
 */
function fixtureData({ leeg = false, buffer = false } = {}) {
  // De buffer-variant zet één bufferpot en één kost die de pot ver overstijgt, zodat de
  // maandfooter alle drie zijn standen laat zien: opbouw, stilstand, en een stand die
  // negatief staat. Zonder die derde stand kan geen enkele check onderscheiden of de
  // footer de positie of de potstand toont — die vallen samen zolang de pot volstaat.
  if (buffer) {
    return {
      referenceBalance: 1000,
      referenceMonth: BRON,
      historyStartMonth: BRON,
      balanceOverrides: [],
      expenseItems: [
        { id: 'harness-1', monthKey: BRON, label: LABEL, amount: AMOUNT, paid: false },
        { id: 'harness-tekort', monthKey: monthKey(2), label: 'Harnastekort', amount: 1600, paid: false },
      ],
      // Inkomen in de middelste kolom, zodat één van de drie footers een overschot toont:
      // anders staat er nooit een `+` op het scherm en blijft die tak van de regex blind.
      incomeItems: [{ id: 'harness-in', monthKey: DOEL, label: 'Harnasinkomen', amount: 500 }],
      recurringItems: [],
      recurringSettlements: [],
      reservationSettlements: [],
      reservations: [
        { id: 'harness-buffer', label: 'Reserve', monthlyAmount: 0, startMonth: BRON, type: 'spaardoel', coversDeficit: true },
      ],
      reservationPayments: [],
      recurringDefers: [],
      reservationDefers: [],
      reopenedMonths: [],
    };
  }
  return {
    referenceBalance: leeg ? 0 : 5000,
    referenceMonth: BRON,
    historyStartMonth: BRON,
    balanceOverrides: [],
    expenseItems: leeg ? [] : [{ id: 'harness-1', monthKey: BRON, label: LABEL, amount: AMOUNT, paid: false }],
    incomeItems: [],
    recurringItems: [],
    recurringSettlements: [],
    reservationSettlements: [],
    reservations: leeg
      ? []
      : [{ id: 'harness-pot', label: POT, monthlyAmount: 60, startMonth: BRON, type: 'spaardoel' }],
    reservationPayments: [],
    recurringDefers: [],
    reservationDefers: [],
    reopenedMonths: [],
  };
}

function session() {
  const nu = Math.floor(Date.now() / 1000);
  return {
    access_token: 'harness-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nu + 3600,
    refresh_token: 'harness-refresh-token',
    user: {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'harness@umanex.be',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    },
  };
}

// ── Supabase-origin: alles onderscheppen, de rest afbreken ───────────────────
function supabaseUrl() {
  // De omgevingsvariabele gaat voor, zodat CI dezelfde placeholder kan meegeven als de
  // build (zie ci.yml) — `.env.local` staat niet in git en bestaat daar dus niet.
  const uitEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (uitEnv) return uitEnv.trim().replace(/\/+$/, '');

  const env = resolve(APP, '.env.local');
  if (!existsSync(env)) {
    throw new Error(
      `Geen NEXT_PUBLIC_SUPABASE_URL in de omgeving en geen ${env}.\n` +
        'Zonder die waarde weet de harness niet welke origin hij moet afsluiten, en dat is de hele veiligheidsgarantie.',
    );
  }
  const match = readFileSync(env, 'utf8').match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m);
  if (!match) throw new Error('NEXT_PUBLIC_SUPABASE_URL ontbreekt in .env.local.');
  return match[1].trim().replace(/\/+$/, '');
}

/**
 * Welke Supabase-origins zitten er ingebakken in de build die we zo gaan serveren?
 *
 * `NEXT_PUBLIC_`-waardes worden bij het bouwen in de bundel gezet; de harness leest ze op
 * dat moment níet, hij leest zijn eigen omgeving. Lopen die twee uiteen, dan sluit
 * `page.route()` een origin af waar de app helemaal niet naartoe gaat — en dan is
 * "0 verzoeken naar de echte origin" een lege bewering. De gevaarlijke richting is
 * harness=placeholder met een build op de échte URL: die verzoeken vertrekken gewoon, ze
 * falen niet eens, en niets in de uitslag verraadt het.
 */
function originsInBuild() {
  const gevonden = new Set();
  const patroon = /https:\/\/[a-z0-9-]+\.supabase\.co/g;

  const loop = (dir) => {
    let inhoud;
    try {
      inhoud = readdirSync(dir);
    } catch {
      return;
    }
    for (const naam of inhoud) {
      const pad = `${dir}/${naam}`;
      if (statSync(pad).isDirectory()) loop(pad);
      else if (naam.endsWith('.js')) {
        for (const m of readFileSync(pad, 'utf8').matchAll(patroon)) gevonden.add(m[0]);
      }
    }
  };

  loop(resolve(DIST_PAD, 'static/chunks'));
  return gevonden;
}

/** Weigert te starten wanneer de build een andere origin draagt dan we afsluiten. */
function controleerBuildOrigin(origin) {
  const inBuild = originsInBuild();

  if (inBuild.size === 0) {
    throw new Error(
      `Geen enkele supabase-origin gevonden in ${DIST}/static/chunks.\n` +
        'De harness kan dan niet vaststellen dat hij de origin afsluit waar de app naartoe gaat, ' +
        'en dat is zijn hele veiligheidsgarantie. Bouw opnieuw, of pas deze check aan als de ' +
        'bundel-indeling veranderd is.',
    );
  }

  const vreemd = [...inBuild].filter((o) => o !== origin);
  if (vreemd.length) {
    throw new Error(
      `De build praat met ${vreemd.join(', ')}, de harness sluit ${origin} af.\n` +
        'Die verzoeken zouden langs de onderschepping heen gaan — naar een echte server, met ' +
        'echte data. Een build die de harness zelf maakt erft zijn omgeving, dus dit betekent dat ' +
        `${DIST} een hergebruikte build is (--no-build of --dist=.next) uit een andere omgeving. ` +
        `Bouw hem met NEXT_PUBLIC_SUPABASE_URL=${origin}, of laat de harness zelf bouwen.`,
    );
  }
}

/**
 * Beantwoordt wat de app nodig heeft en breekt al het overige af. Fail-closed: een pad dat
 * hier niet staat, komt niet op het netwerk maar in `lekken` — en laat de run vallen. Dat
 * is de hele veiligheidsgarantie, dus hier nooit een `route.continue()` toevoegen.
 *
 * `gedrag` is wat een scenario aan het antwoord mag draaien — leeg document, trage fetch,
 * serverfout. Zonder die knop kon de harness alleen het geslaagde pad tonen, en juist de
 * drie andere schermen (skeleton, lege staat, foutscherm) zag nooit een guard.
 */
function maakRouteHandler(state, gedrag = {}) {
  const { leeg = false, buffer = false, vertragingMs = 0, documentStatus = 200 } = gedrag;

  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pad = url.pathname;
    const json = (body, status = 200, headers = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });

    // Auth — inloggen, verversen, en de gebruiker opvragen.
    if (pad.startsWith('/auth/v1/token') || pad === '/auth/v1/signup') return json(session());
    if (pad === '/auth/v1/user') return json(session().user);
    if (pad === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' });
    if (pad.includes('/.well-known/jwks.json')) return json({ keys: [] });

    // Het document. `maybeSingle()` wil één object, geen array.
    if (pad === '/rest/v1/cashflow_state') {
      if (req.method() === 'GET') {
        if (vertragingMs) await new Promise((r) => setTimeout(r, vertragingMs));
        if (documentStatus !== 200) {
          return json({ message: 'harness: opzettelijke serverfout' }, documentStatus);
        }
        return json({ data: fixtureData({ leeg, buffer }), revision: state.revision }, 200);
      }
      // Elke schrijfpoging wordt geteld en beantwoord alsof ze lukte: de app moet
      // verder kunnen, en het bewijs dat er niets weglekte is juist dat we hier staan.
      state.schrijfpogingen.push(`${req.method()} ${pad}`);
      state.revision += 1;
      return json([{ revision: state.revision }], 200);
    }

    if (pad === '/rest/v1/cashflow_snapshots') {
      if (req.method() === 'GET') return json([]);
      state.schrijfpogingen.push(`${req.method()} ${pad}`);
      return json([], 200);
    }

    state.lekken.push(`${req.method()} ${pad}`);
    return route.abort();
  };
}

// ── Server ───────────────────────────────────────────────────────────────────

/** Luistert er al iets op de poort? Zo ja: niet starten. */
async function poortBezet() {
  try {
    await fetch(BASE, { redirect: 'manual', signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Bouwt de app in DIST. De uitvoer wordt opgevangen en alleen bij een fout getoond; bij
 * succes één regel met de duur. Geen eigen procesgroep: `next build` eindigt vanzelf.
 */
async function bouw() {
  const bin = require_.resolve('next/dist/bin/next');
  const start = Date.now();
  console.log(`Flow-harness — bouwt in ${DIST} …`);
  const proc = spawn(process.execPath, [bin, 'build'], {
    cwd: APP,
    env: { ...process.env, NEXT_DIST_DIR: DIST },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  proc.stdout.on('data', (d) => (logs += d));
  proc.stderr.on('data', (d) => (logs += d));
  const code = await new Promise((r) => proc.on('close', r));
  if (code !== 0) {
    throw new Error(`next build viel om (exit ${code}):\n${logs.split('\n').slice(-40).join('\n')}`);
  }
  console.log(`Flow-harness — build klaar in ${Math.round((Date.now() - start) / 1000)}s`);
}

function buildId() {
  return readFileSync(resolve(DIST_PAD, 'BUILD_ID'), 'utf8').trim();
}

/**
 * "Serveert <map>" mag niet van de schijf komen: Next koppelt de geserveerde map nergens
 * aan wat er net gebouwd is, dus een `next start` zonder NEXT_DIST_DIR zou stil `.next`
 * serveren terwijl de log `.next-harness` claimt. Vraag de server dus om het manifest van
 * díe BUILD_ID; een andere build op die poort geeft 404.
 */
async function controleerGeserveerdeBuild(id) {
  const res = await fetch(`${BASE}/_next/static/${id}/_buildManifest.js`, { redirect: 'manual' });
  if (res.status !== 200) {
    throw new Error(
      `${BASE} serveert niet ${DIST} (BUILD_ID ${id}): het manifest gaf ${res.status}. ` +
        'Een andere build op die poort, of NEXT_DIST_DIR kwam niet bij `next start` aan.',
    );
  }
}

/** Vóór de origin-check: die leest de chunks en zou een ontbrekende build als "bouw opnieuw" melden. */
function controleerBuildAanwezig() {
  if (existsSync(resolve(DIST_PAD, 'BUILD_ID'))) return;
  throw new Error(
    `Geen build in apps/cashflow/${DIST}.` +
      (LIVE_MAP
        ? ' `--dist=.next` serveert alleen wat er staat en bouwt daar nooit in — dat is de map waar een draaiende server uit leest. Laat de flag weg zodat de harness in .next-harness bouwt, of bouw eerst zelf (`pnpm --filter cashflow build`) waar geen server draait.'
        : ' Laat `--no-build` weg zodat de harness hem zelf maakt.'),
  );
}

async function startServer() {

  // Zonder deze check test de harness wat er tóevallig op de poort staat. `next start`
  // valt dan om met EADDRINUSE terwijl de eerste fetch slaagt tegen de vréémde server —
  // en de run rapporteert over een app die hij nooit gestart heeft.
  if (await poortBezet()) {
    throw new Error(
      `Er luistert al iets op ${BASE}. De harness start zijn eigen server en weigert een vreemde te testen.\n` +
        `Ruim hem op of geef een andere poort: --port=3105`,
    );
  }

  const bin = require_.resolve('next/dist/bin/next');
  // Eigen procesgroep, zodat de teardown de hele boom kan afsluiten. Een SIGTERM naar
  // alleen het bovenste proces liet hier een luisterende server achter.
  const proc = spawn(process.execPath, [bin, 'start', '--port', String(PORT)], {
    cwd: APP,
    // Dezelfde variabele als bij de build: `next start` leest next.config.mjs opnieuw en
    // moet op dezelfde distDir uitkomen, anders serveert hij `.next` van iemand anders.
    env: { ...process.env, NEXT_DIST_DIR: DIST },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  let logs = '';
  proc.stdout.on('data', (d) => (logs += d));
  proc.stderr.on('data', (d) => (logs += d));

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`next start viel om (exit ${proc.exitCode}):\n${logs}`);
    try {
      const res = await fetch(BASE, { redirect: 'manual' });
      if (res.status < 500) return proc;
    } catch {
      /* nog niet op */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  stopServer(proc);
  throw new Error(`next start werd niet bereikbaar op ${BASE} binnen 60s:\n${logs}`);
}

function stopServer(proc) {
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    try {
      proc.kill('SIGTERM');
    } catch {
      /* al weg */
    }
  }
}

// ── Pagina klaarzetten ───────────────────────────────────────────────────────
const KOLOM = '.grid.grid-cols-3 > div';

/**
 * Logt in en geeft de pagina terug. `wachtOp: 'kolommen'` wacht tot de prognose staat;
 * `'niets'` geeft de pagina meteen terug, want een scenario dat juist de laad- of
 * foutstaat meet mag niet wachten op een scherm dat er nooit komt.
 */
async function openApp(context, state, { gedrag = {}, wachtOp = 'kolommen' } = {}) {
  const page = await context.newPage();
  page.on('pageerror', (err) => state.paginafouten.push(String(err).slice(0, 200)));

  // Twee lagen, in deze volgorde. Playwright laat de laatst geregistreerde route eerst
  // kiezen, dus de vangnet-route staat hier bovenaan en de specifieke eronder.
  //
  // Laag 1 — het vangnet: élke andere host die naar Supabase ruikt, wordt afgebroken en
  // geteld als lek. `controleerBuildOrigin()` hoort dit al onmogelijk te maken, maar een
  // veiligheidsgarantie die op één check rust, rust op te weinig.
  await page.route(
    (url) => /supabase/i.test(url.hostname) && url.origin !== state.origin,
    (route) => {
      state.lekken.push(`${route.request().method()} ${route.request().url()}`);
      return route.abort();
    },
  );

  // Laag 2 — de origin die de app hoort te gebruiken, uit de fixture bediend.
  await page.route(`${state.origin}/**`, maakRouteHandler(state, gedrag));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // Elke wachtstap meldt wat er wél op het scherm stond. Een kale "Timeout waiting for
  // #email" laat je raden of de app niet hydrateerde, of al ingelogd was, of viel.
  const wacht = async (selector, wat) => {
    try {
      await page.waitForSelector(selector, { timeout: 20_000, state: 'visible' });
    } catch {
      const tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 240));
      const lek = state.lekken.length ? ` Onderweg afgebroken: ${state.lekken.slice(0, 2).join(', ')}.` : '';
      throw new Error(`${wat} verscheen niet. Op het scherm stond: "${tekst}"${lek}`);
    }
  };

  // supabase-js bewaart de sessie in localStorage, dus een tweede scenario in dezelfde
  // context komt al ingelogd binnen. Elk scenario krijgt hier een eigen context, maar de
  // check blijft staan: hem weglaten kostte een run aan een timeout op een formulier dat
  // er terecht niet was.
  const loginZichtbaar = await page
    .waitForSelector('#email', { timeout: 5_000, state: 'visible' })
    .then(() => true)
    .catch(() => false);

  if (loginZichtbaar) {
    await page.fill('#email', 'harness@umanex.be');
    await page.fill('#password', 'harness');
    await page.click('button[type=submit]');
  }

  if (wachtOp === 'kolommen') {
    await wacht(KOLOM, 'de maandkolommen');
    if (!gedrag.leeg) await wacht(`text=${LABEL}`, `de fixture-post "${LABEL}"`);
  }
  return page;
}

/** In welke kolom (0-based) staat de post nu? -1 wanneer hij nergens staat. */
async function kolomVanPost(page, label) {
  return page.evaluate(
    ([sel, l]) => [...document.querySelectorAll(sel)].findIndex((k) => k.textContent.includes(l)),
    [KOLOM, label],
  );
}

/** De sleepgreep van de post: de knop 'Versleep' in de rij die het label draagt. */
function greep(page, label) {
  return page.locator('div', { hasText: label }).locator('button[aria-label="Versleep"]').last();
}

// ── De saldoregel ────────────────────────────────────────────────────────────

const SALDO = /Beginsaldo|Vorig saldo/;

/**
 * Bedrag uit een rijtekst als getal. Punt is duizendtal, komma is decimaal. Het teken
 * staat vóór het euroteken en is een echt minteken (U+2212), niet het ASCII-koppelteken
 * dat `Intl` zelf ná het symbool zou zetten — zie `formatAmount` in lib/cashflow/recurring.ts.
 * Zonder die normalisatie valt het teken weg in de klassefilter hieronder en leest een
 * tekort als een tegoed.
 */
function bedragUit(tekst) {
  const cijfers = tekst.replace(/[−–]/g, '-').replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cijfers);
  return Number.isNaN(n) ? null : n;
}

/**
 * De saldoregel van elke maandkolom: staat hij er, welk label draagt hij, welk bedrag, en
 * staat hij bínnen de inkomstensectie? Sinds 2026-08-10 hoort hij daar te staan — de
 * inkomstenkop draagt `subtotals.incoming` en de regels eronder moeten tot die kop
 * optellen — en verdwijnt hij uit een latere maand zodra het doorgerolde saldo nul is.
 *
 * `.last()` is bewust: elke voorouder van de rij bevat het label ook, en in
 * documentvolgorde komt de rij zelf als laatste. Dezelfde truc als in `greep()`.
 */
async function saldoPerKolom(page) {
  const kolommen = page.locator(KOLOM);
  const aantal = await kolommen.count();
  const uit = [];

  for (let i = 0; i < aantal; i++) {
    const kolom = kolommen.nth(i);
    const tekst = (await kolom.innerText()).replace(/\s+/g, ' ');
    const treffer = tekst.match(SALDO);

    if (!treffer) {
      uit.push({ kolom: i, aanwezig: false });
      continue;
    }

    const rijtekst = (await kolom.locator('div').filter({ hasText: SALDO }).last().innerText())
      .replace(/\s+/g, ' ');

    uit.push({
      kolom: i,
      aanwezig: true,
      label: treffer[0],
      bedrag: bedragUit(rijtekst),
      // Binnen de sectie = ná de inkomstenkop en vóór de kop van de volgende sectie.
      inSectie:
        tekst.indexOf('Inkomsten') < treffer.index && treffer.index < tekst.indexOf('Vaste uitgaves'),
      rijtekst,
    });
  }

  return uit;
}

// ── De maandfooter ───────────────────────────────────────────────────────────

/**
 * De twee regels van de footer, in documentvolgorde en pal na elkaar. Dat "pal na elkaar"
 * is de tweede assertie in deze ene regex: stond er nog een derde regel tussen — "Niet
 * gedekt", die tot 2026-09-06 het tekort droeg — dan matcht hij niet meer.
 */
// `formatSigned` schrijft een opbouw als `+€ 862,58`, dus het teken moet in de klasse:
// zonder de `+` matcht een overschotmaand niet en meldt het scenario "geen footer" — een
// instrument dat omvalt in plaats van meet.
const FOOTER = /Deze maand ([+−]?€ [\d.,]+) Buffer ([+−]?€ [\d.,]+)/;

async function footerPerKolom(page) {
  const kolommen = page.locator(KOLOM);
  const aantal = await kolommen.count();
  const uit = [];

  for (let i = 0; i < aantal; i++) {
    const tekst = (await kolommen.nth(i).innerText()).replace(/\s+/g, ' ');
    const treffer = tekst.match(FOOTER);
    uit.push(
      treffer
        ? { kolom: i, aanwezig: true, beweging: bedragUit(treffer[1]), stand: bedragUit(treffer[2]), rijtekst: treffer[0] }
        : { kolom: i, aanwezig: false, rijtekst: tekst.slice(-140) },
    );
  }

  return uit;
}

// ── De twee sleeppaden ───────────────────────────────────────────────────────

/**
 * Toetsenbord. dnd-kit's KeyboardSensor activeert op Spatie, beweegt op pijltjes en laat
 * los op Spatie.
 *
 * Eén ArrowRight, niet meer: de coordinateGetter springt per stap naar de dichtstbijzijnde
 * kolom in die richting, dus één stap hoort exact één kolom op te schuiven. Ruimer drukken
 * maakt de assertie zwakker — twintig stappen landden bij het eerste groene resultaat in
 * kolom 2, en dat had ook "beweegt onvoorspelbaar" kunnen betekenen.
 */
async function toetsenbordpad(page) {
  const handle = greep(page, LABEL);
  await handle.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);

  const opgepakt = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute('aria-pressed') === 'true';
  });
  if (!opgepakt) throw new Error('de post werd niet opgepakt (aria-pressed bleef uit)');

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
}

/**
 * Muis. PointerSensor heeft `activationConstraint: { distance: 8 }`, dus één sprong van
 * A naar B activeert de sleep niet — er moeten tussenliggende bewegingen zijn. Dat is
 * precies waarom `left_click_drag` uit een browser-tool hier niets bewees.
 */
async function muispad(page) {
  const handle = greep(page, LABEL);
  const van = await handle.boundingBox();
  const doel = await page.locator(KOLOM).nth(1).boundingBox();
  if (!van || !doel) throw new Error('greep of doelkolom niet in beeld');

  await page.mouse.move(van.x + van.width / 2, van.y + van.height / 2);
  await page.mouse.down();
  // Eerst een korte beweging om de 8px-drempel te passeren, dan in stappen naar het doel.
  await page.mouse.move(van.x + van.width / 2 + 12, van.y + van.height / 2, { steps: 6 });
  await page.mouse.move(doel.x + doel.width / 2, doel.y + doel.height / 2, { steps: 25 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

/**
 * Sleep-assertie: de post hoort van kolom 0 naar kolom 1 te zijn verhuisd, en de app hoort
 * dat te willen wegschrijven. `sync.ts` schrijft met 800ms debounce weg — even wachten
 * maakt van "er kan niets weglekken" een waarneming in plaats van een redenering.
 */
async function verhuisd(page, state, schrijfVoor) {
  await page.waitForTimeout(1_200);
  const geschreven = state.schrijfpogingen.length - schrijfVoor;
  const na = await kolomVanPost(page, LABEL);
  if (na === 1) {
    return { ok: true, bewijs: `post verhuisde van kolom 0 naar kolom 1 (${BRON} → ${DOEL}); ${geschreven} wegschrijf-call onderschept` };
  }
  if (na === 0) return { ok: false, bewijs: 'post staat na afloop nog steeds in kolom 0 — er is niets verplaatst' };
  return { ok: false, bewijs: `post belandde in kolom ${na}, verwacht was kolom 1` };
}

// ── Contrast op het échte scherm ─────────────────────────────────────────────

/**
 * Dezelfde meting als `dom-sweep.mjs`, maar op de draaiende app. Dit is de enige plek waar
 * `MonthCard` en de modals gemeten worden; statisch zijn ze niet te renderen zonder de
 * store en dnd-kit na te bouwen, en dan meet je je eigen namaak.
 */
async function sweep(page, waar) {
  await page.addStyleTag({ content: STIL_CSS });
  const { fouten, gemeten, onmeetbaar, vrijgesteld } = beoordeel(await page.evaluate(meetInPagina));
  return { waar, fouten, gemeten, onmeetbaar: onmeetbaar.length, vrijgesteld };
}

// ── Modals ───────────────────────────────────────────────────────────────────
/**
 * Selecteer op `aria-label`, niet op `[role=dialog]` alleen. Beide sidepanels staan
 * permanent gemonteerd als `role="dialog" aria-modal="true"` en worden enkel met
 * `translate-x-full` uit beeld geschoven — voor Playwright zijn ze dus zichtbaar, en een
 * kale `[role=dialog]` matcht er meteen één. Dat kwam boven doordat de tegenproef
 * "modal die niemand opent" gróen was.
 */
const MODALS = {
  herhaal: {
    naam: 'Herhaal vorige maand',
    open: (page) => page.locator('button', { hasText: '↻ Herhaal' }).first(),
    dialoog: '[role=dialog][aria-label^="Posten overnemen"]',
  },
  betaling: {
    naam: 'Betaling registreren',
    open: (page) => page.locator('button[aria-label="Betaling registreren"]').first(),
    dialoog: '[role=dialog][aria-label="Betaling registreren"]',
  },
};

/**
 * Opent een modal en sluit hem weer met Escape. Dat sluiten ís de assertie: tot 2026-08-08
 * luisterde geen enkele overlay naar Escape, en de harness moest via "Annuleren" sluiten.
 * Nu dat gefixt is, hoort een teruggedraaide fix hier meteen rood te staan.
 */
async function metModaalOpen(page, modal, tijdensOpen, { sluitToets = 'Escape' } = {}) {
  await modal.open(page).click();
  await page.waitForSelector(modal.dialoog, { timeout: 10_000, state: 'visible' });
  const resultaat = tijdensOpen ? await tijdensOpen() : null;
  await page.keyboard.press(sluitToets);
  await page.waitForSelector(modal.dialoog, { timeout: 5_000, state: 'detached' });
  return resultaat;
}

// ── Sidepanels ───────────────────────────────────────────────────────────────
// Ze blijven gemonteerd wanneer ze dicht zijn, dus is "onbereikbaar" hier een assertie en
// geen vanzelfsprekendheid.
const PANELEN = [
  { naam: 'Vaste uitgaven', knop: 'Vaste uitgaven', dialoog: '[aria-label="Vaste uitgaven beheren"]' },
  { naam: 'Spaarpotten', knop: 'Spaarpotten', dialoog: '[aria-label="Spaarpotten beheren"]' },
];

/** Wat het paneel op dit moment aan de a11y-tree vertelt. */
async function panelStaat(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return {
      rol: el.getAttribute('role'),
      ariaModal: el.getAttribute('aria-modal'),
      ariaHidden: el.getAttribute('aria-hidden'),
      inert: el.hasAttribute('inert'),
    };
  }, selector);
}

// ── Runner ───────────────────────────────────────────────────────────────────
/**
 * Eén scenario = één verse context. Anders erft het volgende scenario de sessie én de
 * localStorage van het vorige, en meet je de nasleep van de vorige run.
 *
 * Een scenario levert zelf zijn oordeel: `{ ok, bewijs }`. Dat moest wel — de eerste versie
 * had de sleep-assertie in de runner zitten, en toen kon er niets anders dan een sleep in.
 */
/**
 * Playwright plakt een hele "Call log" onder elke timeout, met kleurcodes. Eén regel met
 * de selector erbij zegt evenveel en houdt de uitslag leesbaar — juist bij de tegenproeven,
 * waar een timeout de bedoeling ís.
 */
function kortBericht(bericht) {
  const regels = String(bericht)
    // eslint-disable-next-line no-control-regex
    .replace(/\[\d+m/g, '')
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);
  const eerste = regels[0] ?? 'onbekende fout';
  const wachtte = regels.find((r) => r.startsWith('- waiting for'));
  return wachtte ? `${eerste} — ${wachtte.slice(2)}` : eerste;
}

async function draaiScenario(browser, state, scenario) {
  const { naam, gedrag = {}, wachtOp = 'kolommen', actie } = scenario;
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  try {
    const page = await openApp(context, state, { gedrag, wachtOp });
    const uitkomst = await actie(page, { state, schrijfVoor: state.schrijfpogingen.length });
    return { naam, ...uitkomst };
  } catch (err) {
    return { naam, ok: false, bewijs: kortBericht(err.message ?? err) };
  } finally {
    await context.close();
  }
}

/** De scenario's die altijd draaien. */
function scenarios() {
  return [
    {
      naam: 'sleep — toetsenbord',
      actie: async (page, { state, schrijfVoor }) => {
        const voor = await kolomVanPost(page, LABEL);
        if (voor !== 0) throw new Error(`de fixture staat niet in kolom 0 maar in ${voor}`);
        await toetsenbordpad(page);
        return verhuisd(page, state, schrijfVoor);
      },
    },
    {
      naam: 'sleep — muis',
      actie: async (page, { state, schrijfVoor }) => {
        const voor = await kolomVanPost(page, LABEL);
        if (voor !== 0) throw new Error(`de fixture staat niet in kolom 0 maar in ${voor}`);
        await muispad(page);
        return verhuisd(page, state, schrijfVoor);
      },
    },
    {
      // Het scherm zelf, en daarna elke modal open. Samen dekt dit wat `dom-sweep.mjs`
      // per constructie niet kan zien.
      naam: 'contrast — scherm + modals',
      actie: async (page) => {
        const metingen = [
          await sweep(page, 'prognose'),
          await metModaalOpen(page, MODALS.herhaal, () => sweep(page, MODALS.herhaal.naam)),
          await metModaalOpen(page, MODALS.betaling, () => sweep(page, MODALS.betaling.naam)),
        ];
        const fouten = metingen.flatMap((m) => m.fouten.map((f) => ({ ...f, waar: m.waar })));
        const gemeten = metingen.reduce((n, m) => n + m.gemeten, 0);
        if (fouten.length) {
          return {
            ok: false,
            bewijs: `${fouten.length} kleurcombinatie(s) onder AA (${gemeten} tekstelementen gemeten)`,
            details: fouten.map((f) => `[${f.waar}]\n${beschrijfFout(f)}`),
          };
        }
        const per = metingen.map((m) => `${m.waar} ${m.gemeten}`).join(', ');
        return { ok: true, bewijs: `${gemeten} tekstelementen boven AA (${per})` };
      },
    },
    {
      // Openen en sluiten is het pad dat de sweep hierboven nodig heeft; dit scenario
      // toetst het als gedrag, zodat een kapotte modal niet als contrast-fout leest.
      naam: 'modals — openen en sluiten',
      actie: async (page) => {
        const gezien = [];
        for (const modal of [MODALS.herhaal, MODALS.betaling]) {
          const kop = await metModaalOpen(page, modal, async () =>
            (await page.locator(modal.dialoog).innerText()).replace(/\s+/g, ' '),
          );
          if (!kop.includes(modal.naam)) {
            throw new Error(`modal toonde "${kop.slice(0, 80)}", verwacht "${modal.naam}"`);
          }
          gezien.push(modal.naam);
        }
        return { ok: true, bewijs: `${gezien.length} modals geopend en met Escape gesloten: ${gezien.join(', ')}` };
      },
    },
    {
      // Een gesloten sidepanel blijft in de DOM staan voor zijn schuif-animatie. Het mag
      // dan geen dialoog meer zijn, niet in de a11y-tree staan en niet tabbaar zijn.
      naam: 'sidepanels — dicht is onbereikbaar',
      actie: async (page) => {
        const bewijzen = [];
        for (const paneel of PANELEN) {
          const dicht = await panelStaat(page, paneel.dialoog);
          if (!dicht) throw new Error(`${paneel.naam}: paneel niet gevonden (${paneel.dialoog})`);
          if (dicht.rol || dicht.ariaModal) {
            throw new Error(`${paneel.naam}: dicht paneel meldt zich nog als ${dicht.rol}/aria-modal=${dicht.ariaModal}`);
          }
          if (dicht.ariaHidden !== 'true' || !dicht.inert) {
            throw new Error(`${paneel.naam}: dicht paneel is bereikbaar (aria-hidden=${dicht.ariaHidden}, inert=${dicht.inert})`);
          }

          await page.locator('header button', { hasText: paneel.knop }).first().click();
          await page.waitForSelector(`${paneel.dialoog}[role=dialog]`, { timeout: 10_000, state: 'visible' });
          const open = await panelStaat(page, paneel.dialoog);
          if (open.inert || open.ariaHidden === 'true') {
            throw new Error(`${paneel.naam}: open paneel is verborgen (aria-hidden=${open.ariaHidden}, inert=${open.inert})`);
          }

          // Escape moet ook hier werken; dat was de tweede helft van dezelfde fix.
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);
          const opnieuwDicht = await panelStaat(page, paneel.dialoog);
          if (opnieuwDicht.rol || !opnieuwDicht.inert) {
            throw new Error(`${paneel.naam}: Escape sloot het paneel niet (role=${opnieuwDicht.rol}, inert=${opnieuwDicht.inert})`);
          }
          bewijzen.push(paneel.naam);
        }
        return { ok: true, bewijs: `${bewijzen.length} panelen: dicht inert + uit de a11y-tree, open bereikbaar, Escape sluit` };
      },
    },
    {
      // De fixture heeft geen bufferpot, dus het eindsaldo wordt nergens naar €0 geveegd
      // en elke kolom opent op een echt bedrag. Alle drie horen dus een saldoregel te
      // tonen — binnen de inkomstensectie, want de kop telt hem mee.
      naam: 'saldo — regel staat in de inkomstensectie',
      actie: async (page, { state, schrijfVoor }) => {
        const rijen = await saldoPerKolom(page);
        if (rijen.length !== 3) throw new Error(`${rijen.length} kolommen in plaats van 3`);

        const ontbreekt = rijen.filter((r) => !r.aanwezig);
        if (ontbreekt.length) {
          throw new Error(
            `kolom ${ontbreekt.map((r) => r.kolom).join(', ')} toont geen saldoregel terwijl er zonder bufferpot wél een saldo doorrolt`,
          );
        }

        const buiten = rijen.filter((r) => !r.inSectie);
        if (buiten.length) {
          throw new Error(
            `saldoregel staat buiten de inkomstensectie in kolom ${buiten.map((r) => r.kolom).join(', ')}`,
          );
        }

        // Kolom 0 is de ankerkolom: daar is het je banksaldo en dus bewerkbaar. De rest
        // toont het doorgerolde saldo en is read-only.
        if (rijen[0].label !== 'Beginsaldo') {
          throw new Error(`kolom 0 draagt "${rijen[0].label}" in plaats van "Beginsaldo"`);
        }
        const verkeerd = rijen.slice(1).filter((r) => r.label !== 'Vorig saldo');
        if (verkeerd.length) {
          throw new Error(
            `kolom ${verkeerd.map((r) => r.kolom).join(', ')} draagt "${verkeerd[0].label}" in plaats van "Vorig saldo"`,
          );
        }

        // Bewerkbaar in de ankerkolom, read-only daarbuiten. Meetbaar aan de rij zelf: daar
        // draagt het bedrag een knop, elders is het tekst. En de rij is geen post — geen
        // sleepgreep, geen verwijderknop — dus dat is meteen de hele knoppentelling.
        const rij = (i) => page.locator(KOLOM).nth(i).locator('div').filter({ hasText: SALDO }).last();
        const knoppen = [];
        for (const r of rijen) knoppen.push(await rij(r.kolom).locator('button').count());
        if (knoppen[0] !== 1) {
          throw new Error(`kolom 0 heeft ${knoppen[0]} knoppen in de saldoregel in plaats van één aanklikbaar bedrag`);
        }
        if (knoppen[1] || knoppen[2]) {
          throw new Error(`een doorgerold saldo is bewerkbaar (kolom 1: ${knoppen[1]}, kolom 2: ${knoppen[2]} knoppen)`);
        }

        // Klikken en wégklikken zónder iets te typen mag niets wegschrijven — dat is de
        // bug uit HANDOFF 2026-08-05, en het pad verhuist met deze regel mee. Meetbaar aan
        // de onderschepte wegschrijf-calls, niet aan het scherm.
        await rij(0).locator('button').click();
        await page.waitForSelector('[aria-label="Beginsaldo aanpassen"]', { timeout: 5_000, state: 'visible' });
        await page.locator('h1').click();
        await page.waitForSelector('[aria-label="Beginsaldo aanpassen"]', { timeout: 5_000, state: 'detached' });
        // Ruim voorbij de 800 ms debounce van lib/cashflow/sync.ts — dezelfde marge als
        // `verhuisd()`. Korter en de teller staat gegarandeerd op nul, ongeacht de code.
        await page.waitForTimeout(1_200);
        const extra = state.schrijfpogingen.length - schrijfVoor;
        if (extra > 0) {
          throw new Error(`wegklikken zonder wijziging stuurde ${extra} wegschrijf-call(s) — de correctie-guard is weg`);
        }

        if (rijen.some((r) => r.bedrag === null)) throw new Error(`onleesbaar bedrag: ${JSON.stringify(rijen)}`);
        return {
          ok: true,
          bewijs: `3 saldoregels binnen de inkomstensectie (${rijen.map((r) => `${r.label} ${r.bedrag}`).join(' · ')}), alleen kolom 0 bewerkbaar, wegklikken schrijft niets`,
        };
      },
    },
    {
      // Zonder posten en zonder referentiebalans staat elke maand op nul. De ankerkolom
      // toont zijn beginsaldo dan nog steeds — daar corrigeer je je banksaldo — maar een
      // latere maand hoort geen regel te tonen die alleen "€ 0,00" herhaalt.
      naam: 'saldo — geen nulregel in latere maanden',
      gedrag: { leeg: true },
      actie: async (page) => {
        const rijen = await saldoPerKolom(page);
        if (rijen.length !== 3) throw new Error(`${rijen.length} kolommen in plaats van 3`);

        if (!rijen[0].aanwezig) throw new Error('de ankerkolom toont geen beginsaldo');
        if (rijen[0].label !== 'Beginsaldo') {
          throw new Error(`kolom 0 draagt "${rijen[0].label}" in plaats van "Beginsaldo"`);
        }
        if (Math.abs(rijen[0].bedrag) >= 0.005) {
          throw new Error(`de lege fixture geeft kolom 0 een saldo van ${rijen[0].bedrag} in plaats van 0`);
        }

        const blijvers = rijen.slice(1).filter((r) => r.aanwezig);
        if (blijvers.length) {
          throw new Error(
            `kolom ${blijvers.map((r) => r.kolom).join(', ')} toont nog een saldoregel: "${blijvers[0].rijtekst}"`,
          );
        }
        return { ok: true, bewijs: 'ankerkolom houdt zijn beginsaldo, kolom 1 en 2 tonen geen nulregel' };
      },
    },
    {
      // De maandfooter met een bufferpot die het tekort niet meer draagt. Tot 2026-09-06
      // stond daar "Buffer € 0,00" naast een aparte regel "Niet gedekt": de pot was leeg,
      // dus de prominentste regel van de kolom meldde nul op het moment dat je er het
      // slechtst voor stond. En "Deze maand" toonde de potbeweging — die per constructie
      // exact de potstand van de maand ervoor is zodra het tekort de pot overstijgt,
      // waardoor het scherm eruitzag alsof het die stand doorschoof.
      naam: 'buffer — negatieve stand in de footer',
      gedrag: { buffer: true },
      actie: async (page) => {
        const rijen = await footerPerKolom(page);
        if (rijen.length !== 3) throw new Error(`${rijen.length} kolommen in plaats van 3`);

        const ontbreekt = rijen.filter((r) => !r.aanwezig);
        if (ontbreekt.length) {
          throw new Error(
            `kolom ${ontbreekt.map((r) => r.kolom).join(', ')} toont geen footer met "Deze maand" direct gevolgd door "Buffer" — staart: ${ontbreekt[0].rijtekst}`,
          );
        }

        // Anker: één onbetaalde kost van 137,42, banksaldo 1000 → de pot vangt de rest op.
        // Tweede maand: 500 inkomen, dus opbouw — die kolom draagt het `+`-teken.
        // Derde maand: een kost van 1600 tegen een pot van 1362,58 — het tekort overstijgt
        // de pot, dus dáár moet de stand negatief zijn in plaats van nul.
        const verwacht = [
          { beweging: -137.42, stand: 862.58 },
          { beweging: 500, stand: 1362.58 },
          { beweging: -1600, stand: -237.42 },
        ];
        for (const [i, v] of verwacht.entries()) {
          if (Math.abs(rijen[i].beweging - v.beweging) >= 0.005) {
            throw new Error(`kolom ${i} beweegt ${rijen[i].beweging} in plaats van ${v.beweging} — "${rijen[i].rijtekst}"`);
          }
          if (Math.abs(rijen[i].stand - v.stand) >= 0.005) {
            throw new Error(`kolom ${i} staat op ${rijen[i].stand} in plaats van ${v.stand} — "${rijen[i].rijtekst}"`);
          }
        }

        // De invariant over het venster, op het scherm gelezen in plaats van in de kern:
        // wat een maand beweegt, brengt je van de vorige stand naar deze.
        const verschil = rijen[2].stand - rijen[1].stand;
        if (Math.abs(verschil - rijen[2].beweging) >= 0.005) {
          throw new Error(`standverschil ${verschil} ≠ beweging ${rijen[2].beweging} in kolom 2`);
        }

        return {
          ok: true,
          bewijs: `kolom 2 toont "${rijen[2].rijtekst}" — stand negatief, beweging is het volle tekort, geen regel "Niet gedekt" ertussen`,
        };
      },
    },
    {
      // De tegenhanger van het scenario hierboven, op de standaardfixture: zonder pot met
      // `coversDeficit` hoort de footer de hint te tonen en géén bedragen. Twee signalen
      // uit dezelfde DOM, in tegengestelde richting — zou de footer tóch zijn twee regels
      // renderen, dan valt de tweede assertie.
      naam: 'buffer — hint zonder bufferpot',
      actie: async (page) => {
        const kolommen = page.locator(KOLOM);
        const aantal = await kolommen.count();
        if (aantal !== 3) throw new Error(`${aantal} kolommen in plaats van 3`);

        const rijen = await footerPerKolom(page);
        const metBedrag = rijen.filter((r) => r.aanwezig);
        if (metBedrag.length) {
          throw new Error(`kolom ${metBedrag.map((r) => r.kolom).join(', ')} toont bufferbedragen zonder bufferpot`);
        }

        for (let i = 0; i < aantal; i++) {
          const tekst = (await kolommen.nth(i).innerText()).replace(/\s+/g, ' ');
          if (!tekst.includes('Geen buffer')) {
            throw new Error(`kolom ${i} toont de hint "Geen buffer" niet — staart: ${tekst.slice(-140)}`);
          }
        }
        return { ok: true, bewijs: 'drie kolommen tonen de hint "Geen buffer" en geen enkel bufferbedrag' };
      },
    },
    {
      // Een trage fetch hoort een skeleton te geven, geen leeg scherm en geen nullen.
      naam: 'state — laden',
      gedrag: { vertragingMs: 2_500 },
      wachtOp: 'niets',
      actie: async (page) => {
        await page.waitForSelector('[aria-busy="true"]', { timeout: 10_000, state: 'visible' });
        // En hij hoort ook weer wég te gaan: een skeleton die blijft staan is even stuk
        // als een die er nooit was.
        await page.waitForSelector(KOLOM, { timeout: 20_000, state: 'visible' });
        return { ok: true, bewijs: 'skeleton met aria-busy tijdens het laden, daarna de prognose' };
      },
    },
    {
      // Geldig document, geen posten: lege staten per sectie, geen blanco kolom.
      naam: 'state — leeg',
      gedrag: { leeg: true },
      actie: async (page) => {
        const verwacht = ['Geen inkomsten', 'Geen vaste uitgaven', 'Geen eenmalige uitgaven'];
        const tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
        const ontbreekt = verwacht.filter((v) => !tekst.includes(v));
        if (ontbreekt.length) throw new Error(`lege staat ontbreekt: ${ontbreekt.join(', ')}`);
        return { ok: true, bewijs: `drie lege staten getoond in plaats van een blanco kolom` };
      },
    },
    {
      // Mislukte fetch: een eigen foutscherm met een herkansing, geen prognose die er
      // wél uitziet alsof ze klopt.
      naam: 'state — fout',
      gedrag: { documentStatus: 500 },
      wachtOp: 'niets',
      actie: async (page) => {
        await page.waitForSelector('text=Gegevens niet geladen', { timeout: 20_000, state: 'visible' });
        const herkansing = await page.locator('button', { hasText: 'Opnieuw proberen' }).count();
        if (!herkansing) throw new Error('foutscherm zonder "Opnieuw proberen" — doodlopend');
        const kolommen = await page.locator(KOLOM).count();
        if (kolommen) throw new Error('de prognose staat er tóch, naast het foutscherm');
        return { ok: true, bewijs: 'foutscherm met herkansing, geen half gevulde prognose' };
      },
    },
  ];
}

/**
 * De tegenproeven. Elke nieuwe assertie krijgt er één: een guard die niet kán afgaan meldt
 * "geen fouten" even overtuigend als een die werkt. Deze horen dus te FALEN; de runner
 * keert hun oordeel om.
 */
function tegenproeven() {
  return [
    {
      naam: 'tegenproef — sleep doet niets',
      moetFalen: true,
      actie: async (page, { state, schrijfVoor }) => {
        await greep(page, LABEL).focus();
        await page.keyboard.press('Space');
        await page.waitForTimeout(150);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        return verhuisd(page, state, schrijfVoor);
      },
    },
    {
      naam: 'tegenproef — te lichte tekst',
      moetFalen: true,
      actie: async (page) => {
        // Eén element met een kleur die gegarandeerd zakt. Vindt de sweep hem niet, dan
        // meet hij het scherm niet echt.
        await page.evaluate(() => {
          const p = document.createElement('p');
          p.textContent = 'tegenproef: onleesbaar grijs';
          p.style.cssText = 'color:#cfcfcf;background:#ffffff;font-size:13px;padding:4px';
          document.body.appendChild(p);
        });
        const m = await sweep(page, 'prognose + injectie');
        if (m.fouten.length) return { ok: false, bewijs: `${m.fouten.length} fout(en) gevonden, zoals het hoort` };
        return { ok: true, bewijs: 'de geïnjecteerde te lichte tekst glipte door de sweep' };
      },
    },
    {
      // De footer-assertie is pas een meting als ze het oude gedrag afkeurt. Slaagt deze,
      // dan toont kolom 2 nog altijd de potstand (€ 0,00) in plaats van de positie, en
      // zegt "buffer — negatieve stand in de footer" niets.
      naam: 'tegenproef — lege pot geldt als een gezonde stand',
      moetFalen: true,
      gedrag: { buffer: true },
      actie: async (page) => {
        const rijen = await footerPerKolom(page);
        const derde = rijen[2];
        if (!derde?.aanwezig) return { ok: false, bewijs: 'kolom 2 heeft geen leesbare footer' };
        if (Math.abs(derde.stand) >= 0.005 || Math.abs(derde.beweging + 1362.58) >= 0.005) {
          return { ok: false, bewijs: `kolom 2 toont "${derde.rijtekst}" — positie, niet de potstand` };
        }
        return { ok: true, bewijs: 'kolom 2 meldde € 0,00 met de potbeweging ernaast' };
      },
    },
    {
      naam: 'tegenproef — modal die niemand opent',
      moetFalen: true,
      actie: async (page) => {
        // Niets aanklikken, wél de modal verwachten. Deze tegenproef verdiende zichzelf
        // meteen terug: met een kale `[role=dialog]`-selector was hij groen, want de
        // sidepanels staan permanent gemonteerd.
        await page.waitForSelector(MODALS.herhaal.dialoog, { timeout: 3_000, state: 'visible' });
        return { ok: true, bewijs: 'de modal stond open zonder dat iemand hem opende' };
      },
    },
    {
      naam: 'tegenproef — willekeurige toets sluit niets',
      moetFalen: true,
      actie: async (page) => {
        // Sluiten met 'a' in plaats van Escape. Slaagt dit, dan sluit de modal om een
        // andere reden dan de toets en zegt de Escape-assertie niets.
        await metModaalOpen(page, MODALS.herhaal, null, { sluitToets: 'a' });
        return { ok: true, bewijs: 'de modal ging dicht van een willekeurige toets' };
      },
    },
    {
      naam: 'tegenproef — open paneel telt als verborgen',
      moetFalen: true,
      actie: async (page) => {
        // Het geopende paneel mág niet inert zijn. Meldt de assertie hier tóch "verborgen",
        // dan meet ze de open-staat niet.
        await page.locator('header button', { hasText: 'Spaarpotten' }).first().click();
        await page.waitForSelector('[aria-label="Spaarpotten beheren"][role=dialog]', { timeout: 10_000, state: 'visible' });
        const open = await panelStaat(page, '[aria-label="Spaarpotten beheren"]');
        if (!open.inert && open.ariaHidden !== 'true') {
          return { ok: false, bewijs: 'open paneel is bereikbaar, zoals het hoort' };
        }
        return { ok: true, bewijs: 'een open paneel gold als verborgen' };
      },
    },
    {
      naam: 'tegenproef — foutscherm zonder fout',
      moetFalen: true,
      actie: async (page) => {
        // Het document komt gewoon door; het foutscherm hoort er dus níet te staan.
        await page.waitForSelector('text=Gegevens niet geladen', { timeout: 3_000, state: 'visible' });
        return { ok: true, bewijs: 'foutscherm verscheen terwijl de fetch slaagde' };
      },
    },
    {
      // Toetst dat `inSectie` echt de plaats meet en niet alleen de aanwezigheid: dit is
      // de oude indeling, met de saldoregel bóven de inkomstenkop.
      naam: 'tegenproef — saldoregel boven de sectie',
      moetFalen: true,
      actie: async (page) => {
        const rijen = await saldoPerKolom(page);
        const boven = rijen.filter((r) => r.aanwezig && !r.inSectie);
        if (!boven.length) throw new Error('elke saldoregel staat binnen de inkomstensectie');
        return { ok: true, bewijs: 'saldoregel stond nog boven de sectie' };
      },
    },
    {
      // Toetst dat de wegschrijf-teller in het saldo-scenario écht kan afgaan: een échte
      // correctie hóórt wél weg te schrijven. Meldt hij ook hier nul, dan meet hij niets.
      naam: 'tegenproef — correctie schrijft niets weg',
      moetFalen: true,
      actie: async (page, { state, schrijfVoor }) => {
        const rij = page.locator(KOLOM).nth(0).locator('div').filter({ hasText: SALDO }).last();
        await rij.locator('button').click();
        const veld = page.locator('[aria-label="Beginsaldo aanpassen"]');
        await veld.waitFor({ timeout: 5_000, state: 'visible' });
        await veld.fill('4242');
        await page.locator('h1').click();
        await page.waitForTimeout(1_200);
        const extra = state.schrijfpogingen.length - schrijfVoor;
        if (extra > 0) throw new Error(`de correctie schreef ${extra} keer weg, zoals het hoort`);
        return { ok: true, bewijs: 'een echte correctie schreef niets weg' };
      },
    },
    {
      // Toetst de andere kant: de verdwijn-regel moet ook echt kunnen afgaan. Op de lege
      // fixture staat elke maand op nul, dus een saldoregel in kolom 1 hoort er niet te zijn.
      naam: 'tegenproef — nulregel in een latere maand',
      moetFalen: true,
      gedrag: { leeg: true },
      actie: async (page) => {
        const rijen = await saldoPerKolom(page);
        if (!rijen[1]?.aanwezig) throw new Error('kolom 1 toont terecht geen nulregel');
        return { ok: true, bewijs: `kolom 1 toonde "${rijen[1].rijtekst}"` };
      },
    },
  ];
}

async function main() {
  const state = {
    origin: supabaseUrl(),
    revision: 1,
    lekken: [],
    schrijfpogingen: [],
    paginafouten: [],
  };

  if (BOUWEN) await bouw();
  controleerBuildAanwezig();

  // Vóór de server, vóór de browser: klopt de origin die we afsluiten met de origin in de
  // build? Zo niet, dan is elke uitspraak over lekken daarna waardeloos.
  controleerBuildOrigin(state.origin);

  console.log(`Flow-harness — ${BRON} → ${DOEL}, origin afgesloten: ${state.origin} (ook in de build)`);

  const id = buildId();
  const teDraaien = [...scenarios(), ...(SELFTEST ? tegenproeven() : [])];
  const resultaten = [];
  const server = await startServer();

  // Alles ná de spawn staat in de try: de server is detached en overleeft een exit(1),
  // dus een throw hier (manifest-check, browser die niet start) zou hem als wees op :3100
  // achterlaten en de volgende run laten weigeren. Ctrl+C bereikt hem om dezelfde reden
  // niet (eigen procesgroep) en Node's default-handler slaat de finally over — dus een
  // eigen signaalhandler, en Playwright's handlers uit zodat er maar één is.
  let browser;
  const bijSignaal = (signaal) => {
    onderbroken = signaal;
    stopServer(server);
    const dicht = browser ? browser.close().catch(() => {}) : Promise.resolve();
    dicht.then(() => process.exit(signaal === 'SIGTERM' ? 143 : 130));
  };
  process.once('SIGINT', bijSignaal);
  process.once('SIGTERM', bijSignaal);
  try {
    await controleerGeserveerdeBuild(id);
    console.log(`Flow-harness — serveert ${DIST} (BUILD_ID ${id}) op ${BASE}`);
    browser = await chromium.launch({ headless: !HEADED, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false });
    for (const scenario of teDraaien) {
      const r = await draaiScenario(browser, state, scenario);
      resultaten.push({ ...r, moetFalen: scenario.moetFalen === true });
    }
  } finally {
    process.off('SIGINT', bijSignaal);
    process.off('SIGTERM', bijSignaal);
    // Server eerst — die teardown mag niet achter een browser.close() hangen die kan gooien.
    stopServer(server);
    if (browser) await browser.close().catch(() => {});
  }

  console.log('');
  const breedte = Math.max(...resultaten.map((r) => r.naam.length));
  for (const r of resultaten) {
    const geslaagd = r.moetFalen ? !r.ok : r.ok;
    console.log(`  ${geslaagd ? '✓' : '✗'} ${r.naam.padEnd(breedte)}  ${r.bewijs}`);
    if (!geslaagd && r.details) for (const d of r.details) console.error(d);
  }

  console.log('');
  console.log(`  schrijfpogingen onderschept: ${state.schrijfpogingen.length}`);
  console.log(`  verzoeken naar buiten afgebroken: ${state.lekken.length}${state.lekken.length ? ` — ${state.lekken.join(', ')}` : ''}`);
  if (state.paginafouten.length) {
    console.log(`  paginafouten: ${state.paginafouten.length} — ${state.paginafouten.slice(0, 3).join(' | ')}`);
  }

  const echteFouten = resultaten.filter((r) => (r.moetFalen ? r.ok : !r.ok));
  const gezakt = echteFouten.length > 0 || state.lekken.length > 0;
  console.log('');
  console.log(gezakt ? `${echteFouten.length} scenario('s) gefaald` : `alle ${resultaten.length} scenario's geslaagd`);
  process.exit(gezakt ? 1 : 0);
}

main().catch((err) => {
  // De server-stop laat een lopend scenario gooien; dan is dit de weg naar buiten, niet de handler.
  if (onderbroken) process.exit(onderbroken === 'SIGTERM' ? 143 : 130);
  console.error(err.message ?? err);
  process.exit(1);
});
