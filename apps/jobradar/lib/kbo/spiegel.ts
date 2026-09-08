import 'server-only'
import { existsSync } from 'fs'
import { join } from 'path'
import Database from 'better-sqlite3'
import { kboDatum } from './csv'
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
  if (!verbinding) {
    verbinding = new Database(pad, { readonly: true, fileMustExist: true })
    // De prospect-lijst leest uit twee databases: de rijen uit de spiegel, de CSV-bron en
    // de statussen uit `jobradar.db`. Eén ATTACH in plaats van twee verbindingen die in JS
    // samengevoegd worden, want alleen zo delen de telling en de lijst hun WHERE — en
    // lopen `totaal` en `paginas` niet uiteen van wat er werkelijk staat.
    //
    // Gemeten 2026-09-08 op better-sqlite3 12.10.0: een ATTACH op een readonly verbinding
    // lukt, leest, joint over beide databases — en een INSERT erdoorheen wordt geweigerd
    // met "attempt to write a readonly database". De readonly-vlag draagt dus door.
    const appDb = APP_DB_PAD()
    if (existsSync(appDb)) {
      verbinding.exec(`ATTACH DATABASE '${appDb.replace(/'/g, "''")}' AS jr`)
    } else {
      // Zonder de app-database bestaat `jr.csv_prospects` niet en zou élke query falen op
      // een onbekende tabel. Een lege tabel in het geheugen houdt de SQL geldig en levert
      // exact wat waar is: geen CSV-herkomst.
      verbinding.exec(`ATTACH DATABASE ':memory:' AS jr`)
      verbinding.exec(`CREATE TABLE jr.csv_prospects (
        enterprise_number TEXT PRIMARY KEY, name TEXT, nace_label TEXT, city TEXT,
        employee_count REAL, ebitda REAL, valuation_multiple REAL,
        enterprise_value REAL, equity_value REAL, bestandsnaam TEXT, imported_at TEXT)`)
    }
  }
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
    return { staat: { soort: 'ontbreekt', pad: PAD() }, rijen: [], totaal: 0, pagina: 1, paginas: 0, zonderKbo: 0 }
  }

  const telling = bouwProspectSql(filter, { tellen: true })
  const totaal = (db.prepare(telling.sql).get(...telling.params) as { n: number }).n

  const lijst = bouwProspectSql(filter)
  const rijen = db.prepare(lijst.sql).all(...lijst.params) as ProspectRij[]

  const buiten = bouwZonderKboSql(filter)
  const zonderKbo = (db.prepare(buiten.sql).get(...buiten.params) as { n: number }).n

  return {
    staat: staatVan(db, vandaag),
    rijen,
    totaal,
    pagina: Math.max(1, Math.trunc(filter.pagina || 1)),
    paginas: Math.max(1, Math.ceil(totaal / PAGINA_GROOTTE)),
    zonderKbo,
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
