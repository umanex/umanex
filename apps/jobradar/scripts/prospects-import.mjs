/**
 * Leest een aangeleverde CSV met potentiële bedrijven in `csv_prospects`.
 *
 * Waarom een CLI en geen upload-route: deze app heeft geen auth en draait lokaal. Een
 * route die een bestand aanneemt zou de enige onbeschermde schrijfweg naar de database
 * zijn, voor een handeling die je een paar keer per jaar doet.
 *
 * Waarom niet via `getDb()`: `lib/db/index.ts` begint met `import 'server-only'` en is
 * buiten Next dus niet aan te roepen. `lib/db/ddl.ts` is precies daarvoor losgetrokken —
 * hij heeft nul imports en draagt hetzelfde schema. Zelfde patroon als `kbo-sync.mjs`.
 *
 * Waarom de KBO-parser: `lib/kbo/csv.ts` is RFC 4180 en getoetst op chunkgrenzen,
 * embedded quotes en komma's binnen velden (`scripts/kbo-scenarios.ts`). Het geleverde
 * bestand bevat er één — `DAENINCK, AUDENAERT en Co` — en een naïeve `split(',')` schuift
 * daar stil de kolommen op. Een tweede grammatica onderhouden is de duurdere fout.
 */
import Database from 'better-sqlite3'
import { createReadStream, existsSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { csvObjecten, kboNummer } from '../lib/kbo/csv'
import { SCHEMA_DDL, pasKolomMigratiesToe } from '../lib/db/ddl'

const HIER = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HIER, '..')

const args = process.argv.slice(2)
const DROOG = args.includes('--dry-run')
const bestand = args.find((a) => !a.startsWith('--'))
const DB_PAD = resolve(APP, process.env.JOBRADAR_DB_PATH || '.data/jobradar.db')

/**
 * De negen kolommen zoals ze in de kopregel staan. Ontbreekt er één, dan stoppen we —
 * een ontbrekende kolom stil als NULL invoeren levert een tabel die gevuld lijkt en het
 * niet is, en dat verschil is achteraf niet meer te zien.
 */
const KOLOMMEN = {
  name: 'name',
  enterpriseNumber: 'enterpriseNumber',
  naceLabel: 'naceLabel',
  city: 'city',
  employeeCount: 'employeeCount',
  ebitda: 'ebitda',
  valuationMultiple: 'valuationMultiple',
  enterpriseValue: 'enterpriseValue',
  equityValue: 'equityValue',
}

const ok = (s) => console.log(`  ${s}`)
const fout = (s) => console.error(`✗ ${s}`)

/**
 * Een leeg veld is geen 0. 44 van de 218 rijen in het geleverde bestand dragen een lege
 * `enterpriseValue`; die als 0 opslaan maakt van "niet bekend" een waardering van nul, en
 * elke sortering op dat veld zou ze daarna bovenaan of onderaan groeperen alsof dat een
 * meting was.
 */
function getal(waarde) {
  let s = (waarde ?? '').trim()
  if (s === '') return null
  // Een leidende apostrof is een export-artefact, geen data: een spreadsheet leest `-` als
  // het begin van een formule en escapet de cel daarom. Gemeten op het geleverde bestand
  // (2026-09-08): de apostrof staat op 67 rijen en uitsluitend op negatieve waarden — 44
  // in `ebitda`, 23 in `equityValue`, nergens anders. Hem laten staan zou van elk verlies
  // een parseerfout maken; hem samen met het minteken weggooien zou een verliesgevend
  // bedrijf als winstgevend opslaan.
  if (s.startsWith("'")) s = s.slice(1)
  const n = Number(s)
  if (!Number.isFinite(n)) throw new Error(`onverwacht getal: "${waarde}"`)
  return n
}

async function main() {
  if (!bestand) {
    fout('geef het pad naar de CSV mee: pnpm --filter jobradar prospects:import <pad.csv>')
    return 2
  }
  const pad = resolve(process.cwd(), bestand)
  if (!existsSync(pad)) {
    fout(`bestand niet gevonden: ${pad}`)
    return 2
  }

  const db = new Database(DB_PAD)
  db.pragma('journal_mode = WAL')
  db.exec(SCHEMA_DDL)
  pasKolomMigratiesToe(db)

  const nu = new Date().toISOString()
  const naam = basename(pad)

  const bestaand = new Set(
    db.prepare('SELECT enterprise_number FROM csv_prospects').all().map((r) => r.enterprise_number)
  )

  const schrijf = db.prepare(`
    INSERT INTO csv_prospects (
      enterprise_number, name, nace_label, city, employee_count, ebitda,
      valuation_multiple, enterprise_value, equity_value, bestandsnaam, imported_at
    ) VALUES (@nummer, @naam, @nace, @stad, @werknemers, @ebitda, @multiple, @ev, @equity, @bestand, @nu)
    ON CONFLICT(enterprise_number) DO UPDATE SET
      name = excluded.name, nace_label = excluded.nace_label, city = excluded.city,
      employee_count = excluded.employee_count, ebitda = excluded.ebitda,
      valuation_multiple = excluded.valuation_multiple,
      enterprise_value = excluded.enterprise_value, equity_value = excluded.equity_value,
      bestandsnaam = excluded.bestandsnaam, imported_at = excluded.imported_at
  `)

  const rijen = []
  let nr = 1
  let kopGetoetst = false

  for await (const obj of csvObjecten(createReadStream(pad), naam)) {
    nr++
    if (!kopGetoetst) {
      const mist = Object.values(KOLOMMEN).filter((k) => !(k in obj))
      if (mist.length) {
        fout(`kopregel mist ${mist.length} kolom(men): ${mist.join(', ')}`)
        fout(`gevonden: ${Object.keys(obj).join(', ')}`)
        db.close()
        return 1
      }
      kopGetoetst = true
    }

    const nummer = kboNummer(obj[KOLOMMEN.enterpriseNumber])
    if (!/^\d{10}$/.test(nummer)) {
      // Hard stoppen, niet overslaan: `PATCH /api/prospects/[nr]` valideert op exact deze
      // vorm, dus een rij die hier doorglipt levert later een 400 op de statusdropdown
      // zonder dat de lijst iets verraadt.
      fout(`rij ${nr}: "${obj[KOLOMMEN.enterpriseNumber]}" is geen tiencijferig ondernemingsnummer`)
      db.close()
      return 1
    }

    try {
      rijen.push({
        nummer,
        naam: obj[KOLOMMEN.name].trim(),
        nace: obj[KOLOMMEN.naceLabel].trim() || null,
        stad: obj[KOLOMMEN.city].trim() || null,
        werknemers: getal(obj[KOLOMMEN.employeeCount]),
        ebitda: getal(obj[KOLOMMEN.ebitda]),
        multiple: getal(obj[KOLOMMEN.valuationMultiple]),
        ev: getal(obj[KOLOMMEN.enterpriseValue]),
        equity: getal(obj[KOLOMMEN.equityValue]),
        bestand: naam,
        nu,
      })
    } catch (e) {
      fout(`rij ${nr} (${nummer}): ${e.message}`)
      db.close()
      return 1
    }
  }

  const dubbel = rijen.length - new Set(rijen.map((r) => r.nummer)).size
  if (dubbel > 0) {
    // Niet stil laten samenvallen: bij een dubbel nummer wint de laatste rij en verdwijnt
    // de eerste zonder spoor, terwijl de teller wél 218 blijft zeggen.
    fout(`${dubbel} dubbel(e) ondernemingsnummer(s) in het bestand — de bron is niet uniek`)
    db.close()
    return 1
  }

  const nieuw = rijen.filter((r) => !bestaand.has(r.nummer)).length

  if (DROOG) {
    ok(`${naam}: ${rijen.length} rijen gelezen — ${nieuw} nieuw, ${rijen.length - nieuw} bestaand`)
    ok('--dry-run: niets geschreven')
    db.close()
    return 0
  }

  db.transaction((lijst) => {
    for (const r of lijst) schrijf.run(r)
  })(rijen)

  const totaal = db.prepare('SELECT count(*) AS n FROM csv_prospects').get().n
  ok(`${naam}: ${rijen.length} rijen gelezen — ${nieuw} nieuw, ${rijen.length - nieuw} bijgewerkt`)
  ok(`csv_prospects telt nu ${totaal} rijen (${DB_PAD})`)
  db.close()
  return 0
}

process.exit(await main())
