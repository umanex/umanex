#!/usr/bin/env node
/**
 * Flow-harness — rijdt de app uit op een verse build, in een echte browser.
 *
 *   pnpm --filter jobradar flow             # volle run
 *   pnpm --filter jobradar flow --selftest  # bewijst dat hij kán falen
 *   pnpm --filter jobradar flow --headed    # meekijken terwijl het gebeurt
 *   pnpm --filter jobradar flow --shot=.flow-shots  # render per route vastleggen
 *
 * Waarom dit bestaat: zonder uitvoerbaar pad valt de flow-as van `verify` terug op
 * "overgeslagen", en dan is elk acceptatie-item dat door de UI loopt onverifieerbaar.
 * Een screenshot bewijst dat er iets rendert; dit bewijst dat de pagina's laden, dat de
 * navigatie werkt en dat de console schoon is.
 *
 * Vier ontwerpkeuzes, elk tegen een concrete faalvorm:
 *
 * 1. **Verse build, eigen poort.** Draait `next build` en start op een poort die 100 hoger
 *    ligt dan de dev-poort, en weigert als daar al iets luistert. Een dev-server van
 *    iemand anders wordt dus nooit overschreven of herstart — de Beoordeel-stap schrijft,
 *    en dat mag nooit buiten deze harness landen.
 * 2. **Elke externe origin wordt afgebroken en geteld.** Eén lek en de run faalt. Zo kan
 *    deze harness per constructie geen echte data raken, ook niet als de app dat wil.
 * 3. **Console-fouten zijn bevindingen.** Een pagina die rendert maar in de console
 *    schreeuwt, is niet in orde; dat is precies het soort defect dat een screenshot mist.
 * 4. **`--selftest` voegt een scenario toe dat hóórt te falen.** Een harness die alleen
 *    ooit geslaagd is, bewijst niet dat hij meet. Zonder die kant weet je niet of groen
 *    "alles goed" betekent of "ik kijk nergens naar".
 * 5. **Toegankelijkheid wordt gemeten, niet gelezen.** Twee dingen die de UX-audit van
 *    2026-08-11 met de hand vaststelde en daarna stil konden verlopen: de kopstructuur
 *    (h1 → h3, geen h2) en de focus-zichtbaarheid. De toetsenbord-pass loopt de echte
 *    tab-volgorde af en toetst per stop of de computed stijl bij focus verandert — een
 *    differentiële meting, niet een grep op klassenamen. De audit kon dit niet: zijn
 *    browserautomatisering kreeg geen Tab in de pagina (BACKLOG, 2026-08-11).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');

const args = process.argv.slice(2);
const SELFTEST = args.includes('--selftest');
const HEADED = args.includes('--headed');
const SHOT = args.find((a) => a.startsWith('--shot='))?.slice(7) ?? null;
const PORT = Number(args.find((a) => a.startsWith('--port='))?.slice(7) ?? 3103);
const BASE = `http://127.0.0.1:${PORT}`;

/** Routes die moeten laden. Uitbreiden zodra er een scherm bijkomt. */
const ROUTES = ['/', '/instellingen'];

const fails = [];
const notes = [];
function fail(msg) { fails.push(msg); console.log(`  ✗ ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }

function portFree(port) {
  return new Promise((res) => {
    const s = createServer()
      .once('error', () => res(false))
      .once('listening', () => s.close(() => res(true)))
      .listen(port, '127.0.0.1');
  });
}

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, cmdArgs, { cwd: APP, stdio: 'inherit', ...opts });
    p.on('exit', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exit ${code}`))));
  });
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.status < 500) return true;
    } catch { /* nog niet op */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/**
 * Kopstructuur: geen overgeslagen niveau.
 *
 * Meet op de DOM in documentvolgorde, niet op de bron: de kaarttitels worden per rij
 * gerenderd, dus alleen de gerenderde pagina weet hoeveel het er zijn en in welke
 * volgorde ze staan.
 */
async function kopstructuur(page) {
  return page.evaluate(() => {
    const koppen = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({
      niveau: Number(h.tagName[1]),
      tekst: (h.textContent ?? '').trim().slice(0, 40),
    }));
    const problemen = [];
    if (koppen.length && koppen[0].niveau !== 1) {
      problemen.push(`eerste kop is h${koppen[0].niveau}, geen h1`);
    }
    for (let i = 1; i < koppen.length; i++) {
      const sprong = koppen[i].niveau - koppen[i - 1].niveau;
      if (sprong > 1) {
        problemen.push(
          `h${koppen[i - 1].niveau} → h${koppen[i].niveau} bij "${koppen[i].tekst}" (niveau overgeslagen)`
        );
      }
    }
    return { aantal: koppen.length, niveaus: [...new Set(koppen.map((k) => k.niveau))].sort(), problemen };
  });
}

/**
 * Toetsenbordvolgorde + focus-zichtbaarheid.
 *
 * De meting is DIFFERENTIEEL: per tab-stop wordt de computed stijl mét focus bewaard,
 * daarna wordt alles geblurd en dezelfde eigenschappen opnieuw gelezen. Verandert er
 * niets, dan is er geen zichtbare focus — ongeacht welke klassen het element draagt.
 * Een absolute meting zou hier liegen: een kaart met `shadow-md` heeft een box-shadow
 * zonder ooit focus te tonen.
 *
 * `positieve tabindex` wordt apart gemeld: die breekt de documentvolgorde en is de
 * klassieke oorzaak van een volgorde die niet met het beeld overeenkomt.
 */
async function toetsenbord(page, maxStops = 80) {
  await page.evaluate(() => {
    // `blur()` alleen is niet genoeg: het vertrekpunt voor sequentiële focus blijft dan op
    // het laatst gefocuste element staan, en de walk begint dáár in plaats van bovenaan het
    // document. Na een klik op een tabblad zag de pass daardoor alleen wat ná die knop komt.
    // Focus expliciet op body verzet het vertrekpunt wél.
    document.activeElement instanceof HTMLElement && document.activeElement.blur();
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
    for (const el of document.querySelectorAll('[data-tabstop]')) el.removeAttribute('data-tabstop');
  });

  const volgorde = [];
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate((index) => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      if (el.hasAttribute('data-tabstop')) return { rond: true };
      el.setAttribute('data-tabstop', String(index));
      const s = getComputedStyle(el);
      return {
        index,
        tag: el.tagName.toLowerCase(),
        naam: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
        tabindex: el.getAttribute('tabindex'),
        gefocust: `${s.outlineStyle}|${s.outlineWidth}|${s.outlineColor}|${s.boxShadow}`,
      };
    }, i);
    if (stop === null) break;      // terug op body: de cyclus is rond
    if (stop.rond) break;          // dit element hadden we al
    volgorde.push(stop);
  }

  const ongefocust = await page.evaluate(() => {
    document.activeElement instanceof HTMLElement && document.activeElement.blur();
    const uit = {};
    for (const el of document.querySelectorAll('[data-tabstop]')) {
      const s = getComputedStyle(el);
      uit[el.getAttribute('data-tabstop')] = `${s.outlineStyle}|${s.outlineWidth}|${s.outlineColor}|${s.boxShadow}`;
    }
    return uit;
  });

  const problemen = [];
  for (const stop of volgorde) {
    if (ongefocust[String(stop.index)] === stop.gefocust) {
      problemen.push(`geen zichtbare focus: <${stop.tag}> "${stop.naam || '(zonder tekst)'}"`);
    }
    if (stop.tabindex && Number(stop.tabindex) > 0) {
      problemen.push(`positieve tabindex (${stop.tabindex}) op <${stop.tag}> "${stop.naam}" — breekt de documentvolgorde`);
    }
  }
  return { stops: volgorde.length, volgorde, problemen };
}

/**
 * De build-map van de harness. Letterlijk, geen vlag: `next build` wíst zijn doelmap, dus
 * vrije invoer is een wisser. `.next` blijft van de dev-server en van de productie-build.
 */
const DIST = '.next-harness';

async function main() {
  if (!(await portFree(PORT))) {
    console.error(`✗ Poort ${PORT} is bezet. Deze harness start zijn eigen server en mag`);
    console.error(`  nooit een draaiend proces overnemen. Stop dat proces of geef --port=<vrij>.`);
    process.exit(2);
  }

  // Eigen build-map. `.next` is van de dev-server op 3003 en van een eventuele
  // productie-build; `next build` maakt zijn doelmap eerst leeg, dus daar bouwen betekent
  // die server slopen. Een vaste naam en geen vrije invoer: de waarde wordt gewist.
  const env = { ...process.env, NEXT_DIST_DIR: DIST };

  // De nulmeting hoort VÓÓR de handeling die ze moet betrappen. Gemeten 2026-09-09: een
  // eerdere versie las hem er ná uit en bleef groen terwijl de build wél in `.next` was
  // beland — een nulmeting na de handeling meet niets.
  //
  // En niet de mtime van de máp: die beweegt alleen bij toevoegen of verwijderen van een
  // direct kind. `BUILD_ID` is de inhoud zelf en krijgt bij elke build een nieuwe waarde,
  // dus dát is het anker.
  const gedeeld = join(APP, '.next');
  const buildId = (map) => {
    try {
      return readFileSync(join(map, 'BUILD_ID'), 'utf8').trim();
    } catch {
      return null;
    }
  };
  const gedeeldVoor = buildId(gedeeld);

  console.log(`→ Verse build in ${DIST}`);
  await run('npx', ['next', 'build'], { env });

  // "Bouwt in .next-harness" mag niet van de vlag komen: als `distDir` niet zou werken,
  // schrijft de build gewoon in `.next` en zegt de log iets anders dan er gebeurde.
  if (!existsSync(join(APP, DIST))) {
    console.error(`✗ ${DIST} bestaat niet na de build — distDir werkt niet zoals verwacht.`);
    process.exit(2);
  }

  console.log(`→ Server op ${BASE} (uit ${DIST})`);
  const server = spawn('npx', ['next', 'start', '--port', String(PORT)], {
    cwd: APP, stdio: 'ignore', detached: false, env,
  });
  const stop = () => { try { server.kill('SIGTERM'); } catch { /* al weg */ } };
  process.on('exit', stop);
  process.on('SIGINT', () => { stop(); process.exit(130); });

  if (!(await waitForServer(BASE))) {
    stop();
    console.error('✗ Server kwam niet op binnen 60s.');
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext();

  // Alles buiten de eigen origin wordt afgebroken en geteld.
  const leaks = new Set();
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    leaks.add(new URL(url).origin);
    return route.abort();
  });

  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  console.log('→ Routes');
  for (const route of ROUTES) {
    const res = await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    const status = res?.status() ?? 0;
    // Alleen 4xx/5xx is een fout. Een 3xx is dat niet: de Next App Router beantwoordt een
    // `redirect()` met een 307 **mét** HTML-body die client-side doorstuurt, zonder
    // Location-header. Gemeten op partner-portal — `/` en `/partnerzone` gaven 307 terwijl
    // ze gewoon renderen. Wie op de statuscode oordeelt meldt daar twee defecten die er
    // niet zijn; het oordeel hoort te gaan over wat er uiteindelijk op het scherm staat.
    if (status >= 400) { fail(`${route} → HTTP ${status}`); continue; }
    // `domcontentloaded` is te vroeg voor een client-gerenderde app: die heeft dan nog
    // niets in de body staan. Gemeten op enviro-mobile — daar leverde het 0 tekens op een
    // pagina die na de client-side redirect gewoon rendert, dus een vals "wit scherm" op
    // een werkende app. Wachten tot het netwerk stil is; blijft dat uit (long polling,
    // service worker), dan lezen we alsnog wat er staat in plaats van te blijven hangen.
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const text = (await page.locator('body').innerText().catch(() => '')).trim();
    const landed = new URL(page.url()).pathname;
    const where = landed === route ? `${route}` : `${route} → ${landed}`;
    if (text.length < 20) fail(`${where} rendert vrijwel niets (${text.length} tekens)`);
    else ok(`${where} → ${status}, ${text.length} tekens tekst`);

    const koppen = await kopstructuur(page);
    if (koppen.problemen.length) for (const p of koppen.problemen) fail(`${route} kopstructuur: ${p}`);
    else ok(`${route} kopstructuur: ${koppen.aantal} koppen, niveaus ${koppen.niveaus.map((n) => 'h' + n).join(' → ')}`);

    const tb = await toetsenbord(page);
    if (tb.problemen.length) for (const p of tb.problemen) fail(`${route} toetsenbord: ${p}`);
    else ok(`${route} toetsenbord: ${tb.stops} stops, elk met zichtbare focus`);
    notes.push(`${route} tab-volgorde: ${tb.volgorde.map((s) => `${s.tag}${s.naam ? `(${s.naam.slice(0, 18)})` : ''}`).join(' → ') || '(geen)'}`);
    if (SHOT) {
      const name = route === '/' ? 'index' : route.replace(/\//g, '-').replace(/^-/, '');
      const file = resolve(process.cwd(), `${SHOT}/${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      ok(`render vastgelegd: ${file}`);
    }
  }

  // Eén echte interactie. Volgorde is bewust: een `select` wijzigen is overal veilig,
  // een interne link ook. Knoppen worden NIET blind aangeklikt — op dit dashboard heet er
  // één "Sync nu" en die haalt externe data op. Dat zou de origin-guard hierboven terecht
  // als lek tellen en de run laten falen op iets dat geen defect is.
  console.log('→ Interactie (echt aangedreven, geen goto)');
  // De route-lus eindigt op de láátste route. Zonder deze regel zou de interactie
  // meeverhuizen naar /instellingen zodra daar een route bijkomt — daar is geen
  // status-select, dus hij zou stil terugvallen op een linkklik en het filter niet
  // meer aandrijven. De interactie hoort op het dashboard.
  await page.goto(BASE + ROUTES[0], { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  const select = page.locator('select:visible').first();
  // Een link naar de pagina waar je al staat (het logo, meestal) bewijst niets: die
  // "navigeert" naar zichzelf en slaagt altijd. Sluit het huidige pad dus uit.
  const here = new URL(page.url()).pathname;
  const link = page.locator(`a[href^="/"]:visible:not([href="${here}"])`).first();

  if (await select.count()) {
    const options = await select.locator('option').allTextContents();
    const before = await select.inputValue();
    const values = await select.locator('option').evaluateAll((els) => els.map((e) => e.value));
    const target = values.find((v) => v !== before);
    if (target === undefined) {
      notes.push(`select heeft maar één optie (${options[0] ?? '?'}) — niet te wijzigen`);
    } else {
      await select.selectOption(target);
      const after = await select.inputValue();
      if (after === target) ok(`select gewijzigd: "${before}" → "${after}"`);
      else fail(`select nam de wijziging niet aan: bleef "${after}"`);
    }
  } else if (await link.count()) {
    const href = await link.getAttribute('href');
    await link.click();
    await page.waitForLoadState('domcontentloaded');
    const landed = new URL(page.url()).pathname;
    if (landed === href) ok(`klik: ${here} → ${landed}`);
    else notes.push(`klik op ${href} kwam uit op ${landed} (redirect of anchor)`);
  } else {
    notes.push('geen select en geen interne link op de eerste route — interactie niet uitgereden');
  }

  // ── Prospects-tabblad ──────────────────────────────────────────────────────
  // Dit tabblad haalt zijn eigen pagina op en rendert dus pas na een klik. Zonder deze stap
  // meten de kopstructuur- en toetsenbord-passes hierboven een paneel dat nooit gemount is.
  // Een tab-trigger aanklikken is veilig: hij navigeert niet en raakt geen externe bron.
  console.log('→ Prospects-tabblad');
  {
    const trigger = page.locator('[role="tab"]', { hasText: 'Prospects' }).first();
    if (!(await trigger.count())) {
      notes.push('geen Prospects-tabblad gevonden — overgeslagen');
    } else {
      const antwoord = page.waitForResponse((r) => r.url().includes('/api/prospects'), { timeout: 20_000 })
        .catch(() => null);
      await trigger.click();
      const res = await antwoord;
      if (!res) {
        fail('prospects: geen antwoord van /api/prospects binnen 20s');
      } else if (res.status() >= 400) {
        fail(`prospects: /api/prospects → HTTP ${res.status()}`);
      } else {
        const body = await res.json().catch(() => null);
        ok(`prospects: HTTP ${res.status()}, ${body?.totaal ?? '?'} in totaal, spiegel ${body?.staat?.soort ?? '?'}`);
        await page.waitForTimeout(600);

        // De harde grens uit de briefing: hoogstens één pagina in de DOM.
        const kaarten = await page.locator('[role="tabpanel"]:visible h3').count();
        if (body?.staat?.soort === 'ontbreekt') {
          notes.push('prospects: geen KBO-spiegel op deze machine — kaartentelling niet zinvol');
          const melding = await page.locator('[role="tabpanel"]:visible', { hasText: 'kbo:sync' }).count();
          if (melding) ok('prospects: lege staat legt uit wat er moet gebeuren');
          else fail('prospects: geen spiegel én geen uitleg — dat is een stille nul');
        } else if (kaarten > 60) {
          fail(`prospects: ${kaarten} kaarten in de DOM, hoogstens 60 verwacht`);
        } else {
          ok(`prospects: ${kaarten} kaarten in de DOM (grens 60)`);
        }

        const koppen = await kopstructuur(page);
        if (koppen.problemen.length) for (const p of koppen.problemen) fail(`prospects kopstructuur: ${p}`);
        else ok(`prospects kopstructuur: ${koppen.aantal} koppen, niveaus ${koppen.niveaus.map((n) => 'h' + n).join(' → ')}`);

        const tb = await toetsenbord(page);
        if (tb.problemen.length) for (const p of tb.problemen) fail(`prospects toetsenbord: ${p}`);
        else ok(`prospects toetsenbord: ${tb.stops} stops, elk met zichtbare focus`);

        // ── De herkomst- en winstfilters ─────────────────────────────────────
        // Deze twee zijn interne controls: ze veranderen een querystring naar de eigen
        // origin, dus de origin-guard hierboven blijft geldig. Een `select` is het niet —
        // de herkomst is een segmented control uit knoppen — dus de select-interactie
        // eerder in deze run verhuist er niet stil naartoe.
        if (body?.staat?.soort !== 'ontbreekt') {
          // Ankeren op de ROL binnen het zichtbare paneel, niet op één attribuut: de groep
          // werd van `aria-label` naar `aria-labelledby` verbouwd, en een selector op het
          // oude attribuut vond hem toen niet meer. De rol is wat het ding ís; het label is
          // een bewering erover. Tellen hoort erbij — één radiogroup, niet "minstens één".
          const groep = page.locator('[role="tabpanel"]:visible [role="radiogroup"]');
          const aantalGroepen = await groep.count();
          if (aantalGroepen !== 1) {
            fail(`prospects: ${aantalGroepen} radiogroup(s) in het paneel, verwacht 1`);
          } else {
            // Een groep zonder toegankelijke naam is voor een schermlezer naamloos.
            const naam = await groep.evaluate((el) => {
              const via = el.getAttribute('aria-labelledby');
              return via
                ? (document.getElementById(via)?.textContent ?? '').trim()
                : (el.getAttribute('aria-label') ?? '').trim();
            });
            if (naam) ok(`prospects: de herkomst-groep heet "${naam}"`);
            else fail('prospects: de herkomst-groep heeft geen toegankelijke naam');
            const gekozen = await groep.locator('[role="radio"][aria-checked="true"]').innerText();
            if (gekozen.trim() === 'Beide') ok('prospects: herkomst staat standaard op "Beide"');
            else fail(`prospects: herkomst staat bij het laden op "${gekozen.trim()}", verwacht "Beide"`);

            // Roving tabindex: één stop in de tabvolgorde, niet drie. Dat is wat een
            // radiogroup onderscheidt van een rij losse knoppen, en het is meetbaar.
            const inTab = await groep.locator('[role="radio"][tabindex="0"]').count();
            const buitenTab = await groep.locator('[role="radio"][tabindex="-1"]').count();
            if (inTab === 1 && buitenTab === 2) ok('prospects: herkomst is één tabstop (roving tabindex 1/2)');
            else fail(`prospects: herkomst heeft ${inTab} tabstop(s) en ${buitenTab} buiten de volgorde, verwacht 1 en 2`);

            // Pijltjesbediening: de interactie-as van de briefing. Focus de gekozen optie
            // en stap één naar rechts; de selectie hoort mee te verspringen.
            await groep.locator('[role="radio"][tabindex="0"]').focus();
            await page.keyboard.press('ArrowRight');
            await page.waitForTimeout(200);
            const naPijl = (await groep.locator('[role="radio"][aria-checked="true"]').innerText()).trim();
            if (naPijl !== gekozen.trim()) ok(`prospects: pijltje verplaatst de keuze "${gekozen.trim()}" → "${naPijl}"`);
            else fail(`prospects: pijltje veranderde de keuze niet, blijft "${naPijl}"`);

            const lijstAntwoord = page
              .waitForResponse((r) => r.url().includes('/api/prospects') && r.url().includes('herkomst=csv'), { timeout: 20_000 })
              .catch(() => null);
            await groep.locator('[role="radio"]', { hasText: 'Lijst' }).click();
            const lijstRes = await lijstAntwoord;
            if (!lijstRes) {
              fail('prospects: klik op "Lijst" leverde geen verzoek met herkomst=csv');
            } else {
              const lijstBody = await lijstRes.json().catch(() => null);
              const totaalCsv = lijstBody?.totaal ?? -1;
              if (totaalCsv > 0 && totaalCsv < (body?.totaal ?? Infinity)) {
                ok(`prospects: herkomst "Lijst" versmalt ${body?.totaal} → ${totaalCsv}`);
              } else {
                fail(`prospects: herkomst "Lijst" gaf ${totaalCsv}, verwacht een kleiner getal dan ${body?.totaal}`);
              }
              // De rijen zonder KBO-tegenhanger horen gemeld te worden, niet verzwegen.
              if ((lijstBody?.zonderKbo ?? 0) > 0) {
                await page.waitForTimeout(400);
                const melding = await page
                  .locator('[role="tabpanel"]:visible', { hasText: 'niet in de KBO-spiegel' })
                  .count();
                if (melding) ok(`prospects: de ${lijstBody.zonderKbo} rijen buiten de spiegel worden gemeld`);
                else fail(`prospects: ${lijstBody.zonderKbo} rijen vallen buiten de selectie zonder melding`);
              }
            }

            // Sortering: de reden dat dit bestaat is dat de aangeleverde lijst anders
            // onvindbaar is — de CSV-bedrijven landen op rang 221+ van 2939 wanneer er op
            // oprichtingsdatum geordend wordt.
            const sorteer = page.locator('#prospect-sortering');
            if (!(await sorteer.count())) {
              fail('prospects: geen sorteerkeuze gevonden');
            } else {
              const eersteVoor = await page.locator('[role="tabpanel"]:visible h3').first().innerText();
              const sorteerAntwoord = page
                .waitForResponse((r) => r.url().includes('/api/prospects') && r.url().includes('sortering=omvang'), { timeout: 20_000 })
                .catch(() => null);
              await sorteer.selectOption('omvang');
              const sortRes = await sorteerAntwoord;
              if (!sortRes) {
                fail('prospects: sorteren op omvang leverde geen verzoek met sortering=omvang');
              } else {
                await page.waitForTimeout(600);
                const eersteNa = await page.locator('[role="tabpanel"]:visible h3').first().innerText();
                if (eersteNa !== eersteVoor) ok(`prospects: sorteren op omvang verandert de kop "${eersteVoor.trim()}" → "${eersteNa.trim()}"`);
                else fail(`prospects: sorteren op omvang liet de kop op "${eersteVoor.trim()}" staan`);
              }
            }

            // Winstzeef: hij hoort UIT te staan bij het laden, en aangezet hoort hij
            // te melden dat de KBO-herkomst geen EBITDA draagt.
            const winst = page.locator('#alleen-winstgevend');
            if (!(await winst.count())) {
              fail('prospects: geen winstgevendheidsfilter gevonden');
            } else {
              const aanBijStart = await winst.getAttribute('data-state');
              if (aanBijStart === 'unchecked') ok('prospects: "Alleen winstgevend" staat bij het laden uit');
              else fail(`prospects: "Alleen winstgevend" staat bij het laden op "${aanBijStart}", verwacht uit`);

              const winstAntwoord = page
                .waitForResponse((r) => r.url().includes('/api/prospects') && r.url().includes('winstgevend=1'), { timeout: 20_000 })
                .catch(() => null);
              await winst.click();
              const winstRes = await winstAntwoord;
              if (!winstRes) {
                fail('prospects: winstfilter leverde geen verzoek met winstgevend=1');
              } else {
                await page.waitForTimeout(400);
                const uitleg = await page
                  .locator('[role="tabpanel"]:visible', { hasText: 'zeeft op EBITDA' })
                  .count();
                if (uitleg) ok('prospects: de winstzeef legt uit waarom de KBO-herkomst wegvalt');
                else fail('prospects: winstzeef aan zonder uitleg over de wegvallende KBO-herkomst');
              }
            }
          }
        }
      }
    }
  }

  if (SELFTEST) {
    console.log('→ Zelftest (dit scenario hóórt te falen)');
    await page.goto(BASE + '/deze-route-bestaat-niet-' + Date.now(), { waitUntil: 'domcontentloaded' })
      .catch(() => {});
    const res = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    if (res?.status() === 200) fail('ZELFTEST: bewust gefaalde assertie — de harness kan falen');

    // De twee a11y-passes krijgen elk hun eigen defect ingespoten. Een pass die groen
    // blijft op een pagina waar het defect er aantoonbaar ín zit, meet niets.
    await page.evaluate(() => {
      const kop = document.createElement('h5');
      kop.textContent = 'zelftest: overgeslagen niveau';
      document.body.appendChild(kop);
      const knop = document.createElement('button');
      knop.textContent = 'zelftest: onzichtbare focus';
      // !important, anders wint de ring-utility alsnog en toont de knop gewoon focus.
      knop.style.setProperty('outline', 'none', 'important');
      knop.style.setProperty('box-shadow', 'none', 'important');
      // PREPEND, niet append: het dashboard heeft honderden tab-stops en de pass loopt
      // er maxStops af. Achteraan viel de knop buiten het bereik en bleef de zelftest
      // stil groen — gemeten op 2026-08-27, precies de vorm die deze zelftest hoort te
      // vangen. Vooraan is hij de eerste stop, op elke pagina.
      document.body.prepend(knop);
    });
    const kopZelftest = await kopstructuur(page);
    if (kopZelftest.problemen.length) fail(`ZELFTEST kopstructuur: ${kopZelftest.problemen[0]}`);
    else console.log('  ! kopstructuur-pass zag het ingespoten defect NIET');
    const tbZelftest = await toetsenbord(page);
    if (tbZelftest.problemen.length) fail(`ZELFTEST toetsenbord: ${tbZelftest.problemen[0]}`);
    else console.log('  ! toetsenbord-pass zag het ingespoten defect NIET');
  }

  if (consoleErrors.length) {
    for (const e of [...new Set(consoleErrors)].slice(0, 5)) fail(`console: ${e.slice(0, 160)}`);
  } else ok('console schoon');

  const gedeeldNa = buildId(gedeeld);
  if (gedeeldVoor !== gedeeldNa) {
    fail(`de gedeelde .next is herbouwd (BUILD_ID ${gedeeldVoor} → ${gedeeldNa}) — een dev-server daarop zou nu kapot zijn`);
  } else if (gedeeldVoor !== null) {
    ok(`de gedeelde .next is ongemoeid gebleven (BUILD_ID ${gedeeldVoor})`);
  } else {
    notes.push('geen .next met BUILD_ID aanwezig — niets om te beschermen deze run');
  }

  if (leaks.size) fail(`lek naar externe origin(s): ${[...leaks].join(', ')}`);
  else ok('geen enkel verzoek buiten de eigen origin');

  await browser.close();
  stop();

  console.log('');
  for (const n of notes) console.log(`  • ${n}`);
  if (SELFTEST) {
    // Elke as apart: één gefaalde assertie bewees vroeger alleen dat de routecheck meet.
    const assen = ['ZELFTEST:', 'ZELFTEST kopstructuur', 'ZELFTEST toetsenbord'];
    const gemist = assen.filter((a) => !fails.some((f) => f.startsWith(a)));
    console.log(gemist.length === 0
      ? '✓ zelftest: alle drie de assen falen wanneer ze horen te falen'
      : `✗ zelftest: deze as/assen faalden NIET — ${gemist.join(', ')}`);
    process.exit(gemist.length === 0 ? 0 : 1);
  }
  console.log(fails.length ? `✗ ${fails.length} bevinding(en)` : '✓ alle checks geslaagd');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
