/**
 * De verbindingsopbouw van `lib/kbo/spiegel.ts`.
 *
 * Waarom een eigen suite: `open()` haakt twee databases aan elkaar, en de fout zit niet in
 * de SQL maar in de vólgorde en de rechten. Gemeten 2026-09-08 — de eerste versie ving een
 * ontbrekende `jobradar.db` op met `ATTACH ':memory:'` plus een `CREATE TABLE`, op een
 * verbinding die readonly geopend is. Better-sqlite3 trekt die vlag door naar élke ATTACH,
 * dus de tak die de crash moest voorkómen wás de crash — en omdat de verbinding vóór de
 * ATTACH gecachet werd, herstelde het proces er niet meer van.
 *
 * Die tak was ongedekt omdat `spiegel.ts` met `import 'server-only'` begint en dus buiten
 * Next niet te laden was. `scripts/ts-resolve.mjs` stubt dat nu.
 *
 * Waarom een kindproces per geval: `open()` cachet de verbinding op moduleniveau, en die
 * cache is onderdeel van het gedrag dat we toetsen. Drie verse processen zijn de enige
 * manier om drie beginsituaties eerlijk te meten.
 */
import Database from 'better-sqlite3'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCHEMA_DDL } from '../lib/db/ddl'

const HIER = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HIER, '..')

let geslaagd = 0
let gezakt = 0
function check(naam: string, waar: boolean, detail = '') {
  if (waar) {
    geslaagd++
  } else {
    gezakt++
    console.error(`  FAIL  ${naam}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Een spiegel met precies genoeg tabellen om de prospect-query te laten draaien. */
function bouwSpiegel(pad: string) {
  const db = new Database(pad)
  db.exec(`
    CREATE TABLE enterprise ("EnterpriseNumber" TEXT PRIMARY KEY, "Status" TEXT, "StartDate" TEXT);
    CREATE TABLE address ("EntityNumber" TEXT, "TypeOfAddress" TEXT, "Zipcode" TEXT, "MunicipalityNL" TEXT);
    CREATE TABLE activity ("EntityNumber" TEXT, "ActivityGroup" TEXT, "NaceVersion" TEXT, "NaceCode" TEXT, "Classification" TEXT);
    CREATE TABLE denomination ("EntityNumber" TEXT, "Language" TEXT, "TypeOfDenomination" TEXT, "Denomination" TEXT);
    CREATE TABLE contact ("EntityNumber" TEXT, "EntityContact" TEXT, "ContactType" TEXT, "Value" TEXT);
    CREATE TABLE kbo_meta (sleutel TEXT PRIMARY KEY, waarde TEXT);
    INSERT INTO kbo_meta VALUES ('SnapshotDate','08-09-2026'), ('ExtractNumber','999');
    INSERT INTO enterprise VALUES ('3000000001','AC','2020-01-01');
    INSERT INTO address VALUES ('3000000001','REGO','8000','Brugge');
    INSERT INTO activity VALUES ('3000000001','006','2025','62100','MAIN');
    INSERT INTO denomination VALUES ('3000000001','2','001','Fixture NV');
  `)
  db.close()
}

/** Draait `haalProspects` in een vers proces en geeft de uitkomst of de foutmelding terug. */
function haalInKindproces(kboPad: string, appPad: string): { ok: true; totaal: number } | { ok: false; fout: string } {
  const code = `
    const { haalProspects } = await import(${JSON.stringify(join(APP, 'lib/kbo/spiegel.ts'))})
    const r = haalProspects(
      { regions: ['WVL'], alleenWerkgevers: true, herkomst: 'beide', alleenWinstgevend: false, sortering: 'oprichting', pagina: 1 },
      '2026-09-08'
    )
    console.log(JSON.stringify({ ok: true, totaal: r.totaal }))
  `
  try {
    const uit = execFileSync(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--import', join(APP, 'scripts/ts-resolve.mjs'), '--input-type=module', '-e', code],
      { cwd: APP, env: { ...process.env, KBO_DB_PATH: kboPad, JOBRADAR_DB_PATH: appPad }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    )
    return JSON.parse(uit.trim().split('\n').pop() ?? '{}')
  } catch (e) {
    const err = e as { stderr?: string; message: string }
    return { ok: false, fout: (err.stderr ?? err.message).split('\n').find((r) => r.includes('Error')) ?? err.message }
  }
}

const map = mkdtempSync(join(tmpdir(), 'spiegel-'))
try {
  const kbo = join(map, 'kbo.db')
  bouwSpiegel(kbo)

  // ── 1. app-database ontbreekt volledig ─────────────────────────────────────
  // Dit is het geval dat de eerste versie liet crashen. Een verse machine waar
  // `kbo:sync` gedraaid heeft en `/api/prospects` het eerste is dat de app-database raakt.
  {
    const app = join(map, 'ontbreekt', 'jobradar.db')
    const r = haalInKindproces(kbo, app)
    check('app-database ontbreekt: haalProspects werkt', r.ok === true, r.ok ? '' : r.fout)
    check('app-database ontbreekt: levert de fixture-rij', r.ok === true && r.totaal === 1, r.ok ? String(r.totaal) : '—')
    check('app-database ontbreekt: het bestand wordt aangemaakt', existsSync(app))
  }

  // ── 2. app-database bestaat, maar zonder csv_prospects ─────────────────────
  // Een installatie van vóór deze feature. De tabel ontstaat pas bij de eerste `getDb()`,
  // en de route roept `haalProspects` dáárvóór aan.
  {
    const app = join(map, 'oud.db')
    const oud = new Database(app)
    oud.exec(`CREATE TABLE prospect_status (enterprise_number TEXT PRIMARY KEY, status TEXT, updated_at TEXT)`)
    oud.close()
    const r = haalInKindproces(kbo, app)
    check('oude app-database zonder csv_prospects: haalProspects werkt', r.ok === true, r.ok ? '' : r.fout)
    const na = new Database(app, { readonly: true })
    const tabellen = na.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[]
    na.close()
    check(
      'oude app-database krijgt csv_prospects erbij',
      tabellen.some((t) => t.name === 'csv_prospects'),
      tabellen.map((t) => t.name).join(', ')
    )
  }

  // ── 3. beide aanwezig — de positieve controle ──────────────────────────────
  // Zonder dit geval zegt een groene suite niets: dan kan de opstelling het defect
  // misschien helemaal niet opwekken.
  {
    const app = join(map, 'volledig.db')
    const db = new Database(app)
    db.exec(SCHEMA_DDL)
    db.prepare(`INSERT INTO csv_prospects (enterprise_number, name, employee_count, ebitda, bestandsnaam, imported_at)
                VALUES ('3000000001','Fixture NV',10,500,'x','x')`).run()
    db.close()
    const r = haalInKindproces(kbo, app)
    check('volledige app-database: haalProspects werkt', r.ok === true, r.ok ? '' : r.fout)
    check('volledige app-database: levert de fixture-rij', r.ok === true && r.totaal === 1, r.ok ? String(r.totaal) : '—')
  }

  // ── 4. ontbrekende spiegel blijft een lege toestand, geen crash ────────────
  {
    const r = haalInKindproces(join(map, 'bestaat-niet.db'), join(map, 'volledig.db'))
    check('ontbrekende spiegel: geen crash', r.ok === true, r.ok ? '' : r.fout)
    check('ontbrekende spiegel: totaal 0', r.ok === true && r.totaal === 0, r.ok ? String(r.totaal) : '—')
  }

  if (process.env.SCENARIO_SELFTEST === '1') {
    check('zelftest: deze check hoort te falen', false, 'opzettelijk')
  }
} finally {
  rmSync(map, { recursive: true, force: true })
}

const totaal = geslaagd + gezakt
console.log(`${geslaagd}/${totaal} checks geslaagd`)
process.exit(gezakt > 0 ? 1 : 0)
