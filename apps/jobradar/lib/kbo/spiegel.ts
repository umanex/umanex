import 'server-only'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import Database from 'better-sqlite3'
import { kboDatum } from './csv'
import { SCHEMA_DDL, pasKolomMigratiesToe } from '../db/ddl'
import {
  bouwProspectSql,
  bouwZonderKboSql,
  NACE_LABEL,
  PAGINA_GROOTTE,
  type ProspectFilter,
  type ProspectRij,
} from './universum'
import { zoekOnderneming } from './koppeling'
import type { RegionCode } from '../regions'

/**
 * Leestoegang tot de KBO-spiegel.
 *
 * De spiegel is optioneel en wegwerpbaar: hij staat niet in git, wordt door
 * `pnpm --filter jobradar kbo:sync` gevuld en bij elke `--full` overschreven. De app moet
 * daarom zónder hem werken — een ontbrekende spiegel is een lege toestand mét uitleg, geen
 * crash en geen stille nul. Dat onderscheid is het hele punt: "geen prospects" en "geen
 * database" zien er in een lijst identiek uit en betekenen iets heel anders.
 */

const PAD = () => process.env.KBO_DB_PATH ?? join(process.cwd(), '.data', 'kbo.db')

/** Zelfde afleiding als `lib/db/index.ts`, want het is dezelfde database. */
const APP_DB_PAD = () => process.env.JOBRADAR_DB_PATH ?? join(process.cwd(), '.data', 'jobradar.db')

export type SpiegelStaat =
  | { soort: 'ontbreekt'; pad: string }
  | { soort: 'ok'; snapshot: string | null; extract: string | null; ouderdomDagen: number | null }

export type ProspectResultaat = {
  staat: SpiegelStaat
  rijen: ProspectRij[]
  totaal: number
  pagina: number
  paginas: number
  /** Rijen in `csv_prospects`, ongefilterd. Onderscheidt "niets geïmporteerd" van "niets over". */
  csvTotaal: number
  /**
   * CSV-rijen zonder KBO-tegenhanger. Ze kunnen niet in de lijst staan — die vertrekt van
   * `enterprise` en ze dragen geen postcode voor het regiofilter — maar ze verdwijnen niet
   * stil: de UI meldt het aantal boven de lijst.
   */
  zonderKbo: number
}

let verbinding: Database.Database | null = null

function open(): Database.Database | null {
  const pad = PAD()
  if (!existsSync(pad)) return null
  if (verbinding) return verbinding

  // De app-database moet bestáán én zijn schema dragen vóór we hem aanhaken.
  //
  // Twee gemeten redenen, allebei fout gegaan in de eerste versie van dit blok:
  //
  // 1. Een readonly verbinding kan nergens in schrijven, ook niet in een `:memory:`-ATTACH
  //    (better-sqlite3 12.10.0: `CREATE TABLE jr.…` → "attempt to write a readonly
  //    database"). De vorige poging vulde een lege tabel in het geheugen aan wanneer
  //    `jobradar.db` ontbrak — de tak die een crash moest voorkómen wás de crash.
  // 2. `csv_prospects` ontstaat pas bij de eerste `getDb()`, en die hoeft in dit proces
  //    nog niet gedraaid te hebben: `/api/prospects` roept `haalProspects()` aan vóór
  //    `getDb()`. Op een dev-server die herstart terwijl de browser op het
  //    prospects-tabblad staat, is de refetch het eerste dat de database raakt.
  //
  // `SCHEMA_DDL` is idempotent (`CREATE TABLE IF NOT EXISTS`), dus dit is hetzelfde wat
  // `getDb()` doet — alleen eerder, en via een verbinding die het mág.
  const appDb = APP_DB_PAD()
  mkdirSync(dirname(appDb), { recursive: true })
  const schrijfbaar = new Database(appDb)
  try {
    schrijfbaar.exec(SCHEMA_DDL)
    pasKolomMigratiesToe(schrijfbaar)
  } finally {
    schrijfbaar.close()
  }

  const db = new Database(pad, { readonly: true, fileMustExist: true })
  try {
    // De prospect-lijst leest uit twee databases: de rijen uit de spiegel, de CSV-bron en
    // de statussen uit `jobradar.db`. Eén ATTACH in plaats van twee verbindingen die in JS
    // samengevoegd worden, want alleen zo delen de telling en de lijst hun WHERE — en
    // lopen `totaal` en `paginas` niet uiteen van wat er werkelijk staat.
    //
    // De escaping is dragend: getoetst met een pad dat een quote plus een tweede
    // ATTACH-statement bevat — zonder verdubbeling voert `exec` dat tweede statement uit.
    db.exec(`ATTACH DATABASE '${appDb.replace(/'/g, "''")}' AS jr`)
  } catch (e) {
    // Niet cachen wat kapot is: een halfopen verbinding blijft anders het hele proces lang
    // dezelfde fout geven, ook nadat de oorzaak verholpen is.
    db.close()
    throw e
  }

  verbinding = db
  return verbinding
}

function staatVan(db: Database.Database, vandaag: string): SpiegelStaat {
  const lees = (sleutel: string) =>
    (db.prepare('SELECT waarde FROM kbo_meta WHERE sleutel = ?').get(sleutel) as { waarde?: string } | undefined)
      ?.waarde ?? null

  const snapshotRuw = lees('SnapshotDate')
  // kbo_meta bewaart de waarde zoals KBO hem schrijft (DD-MM-YYYY), niet ISO. Rechtstreeks
  // vergelijken zou "28-08-2026" naast "2026-08-29" leggen en altijd verouderd melden.
  const snapshot = snapshotRuw ? kboDatum(snapshotRuw) : null
  const ouderdom =
    snapshot === null ? null : Math.floor((Date.parse(vandaag) - Date.parse(snapshot)) / 86_400_000)

  return { soort: 'ok', snapshot, extract: lees('ExtractNumber'), ouderdomDagen: ouderdom }
}

export function haalProspects(filter: ProspectFilter, vandaag: string): ProspectResultaat {
  const db = open()
  if (!db) {
    // Ook de CSV-bron is hier onzichtbaar: de lijst vertrekt van `enterprise`, dus zonder
    // spiegel is er niets om op te joinen. Dat is een echte beperking en geen detail — de
    // lege toestand in de UI zegt het erbij.
    return { staat: { soort: 'ontbreekt', pad: PAD() }, rijen: [], totaal: 0, pagina: 1, paginas: 0, zonderKbo: 0, csvTotaal: 0 }
  }

  const telling = bouwProspectSql(filter, { tellen: true })
  const totaal = (db.prepare(telling.sql).get(...telling.params) as { n: number }).n

  const lijst = bouwProspectSql(filter)
  const rijen = db.prepare(lijst.sql).all(...lijst.params) as ProspectRij[]

  const csvTotaal = (db.prepare('SELECT COUNT(*) AS n FROM jr.csv_prospects').get() as { n: number }).n

  const buiten = bouwZonderKboSql(filter)
  const zonderKbo = (db.prepare(buiten.sql).get(...buiten.params) as { n: number }).n

  return {
    staat: staatVan(db, vandaag),
    rijen,
    totaal,
    pagina: Math.max(1, Math.trunc(filter.pagina || 1)),
    paginas: Math.max(1, Math.ceil(totaal / PAGINA_GROOTTE)),
    zonderKbo,
    csvTotaal,
  }
}

export type KboVermoeden = {
  nummer: string
  kboNaam: string | null
  gemeente: string | null
  labels: string[]
  viaRegio: boolean
}

/**
 * Zoekt bij elk bedrijf het ondernemingsnummer, plus genoeg context om de gok na te kijken.
 *
 * Het is nadrukkelijk een vermóéden. Gemeten over de 27 echte leads: 12 gekoppeld, 0
 * dubbelzinnig, 15 niet gevonden — en één van die twaalf ("Smile Group") wees naar een
 * tandartspraktijk. De naam was uniek in KBO; uniek is niet juist. Daarom geeft deze functie
 * niet alleen het nummer terug maar ook de officiële naam, de gemeente en de hoofdactiviteit:
 * met die drie herken je een misser in één oogopslag.
 *
 * Bij het renderen aanroepen kost niets — 0,1 ms per opzoeking — en wat niet opgeslagen wordt,
 * kan niet verouderen ten opzichte van de spiegel.
 */
export function koppelBedrijven(
  bedrijven: { naam: string; regio?: RegionCode }[]
): Map<string, KboVermoeden> {
  const db = open()
  const uit = new Map<string, KboVermoeden>()
  if (!db) return uit

  const naamVan = db.prepare(
    `SELECT Denomination AS d FROM denomination
      WHERE EntityNumber = ? AND TypeOfDenomination = '001'
      ORDER BY (Language = '2') DESC LIMIT 1`
  )
  const adresVan = db.prepare(
    `SELECT Zipcode AS z, MunicipalityNL AS m FROM address WHERE EntityNumber = ? LIMIT 1`
  )
  const naceVan = db.prepare(
    `SELECT DISTINCT NaceCode AS c FROM activity
      WHERE EntityNumber = ? AND NaceVersion = '2025' AND Classification = 'MAIN'`
  )

  for (const bedrijf of bedrijven) {
    if (uit.has(bedrijf.naam)) continue
    const gevonden = zoekOnderneming(db, bedrijf.naam, bedrijf.regio)
    if (gevonden.soort !== 'gevonden') continue

    const adres = adresVan.get(gevonden.nummer) as { z?: string; m?: string } | undefined
    const codes = (naceVan.all(gevonden.nummer) as { c: string }[]).map((r) => r.c)
    uit.set(bedrijf.naam, {
      nummer: gevonden.nummer,
      kboNaam: ((naamVan.get(gevonden.nummer) as { d?: string } | undefined)?.d ?? null),
      gemeente: adres?.m ?? null,
      // Alleen de codes uit onze selectie krijgen een label; de rest toont zijn cijfers, want
      // juist een code buiten de selectie (86230 — tandartsen) verraadt een foute koppeling.
      labels: codes.map((c) => NACE_LABEL[c] ?? c),
      viaRegio: gevonden.viaRegio,
    })
  }

  return uit
}
