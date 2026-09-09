/**
 * Haalt eenmalig coördinaten op voor de bedrijven die op de kaart moeten.
 *
 * KBO levert een volledig zeteladres maar geen lat/lon. Deze CLI vult dat gat en bewaart het
 * in `geocode_cache` in `jobradar.db` — niet in de spiegel, want die wordt bij elke `--full`
 * overschreven en dan zou een run van minuten weg zijn.
 *
 * Waarom een CLI en niet tijdens een request: het duurt minuten en het raakt een publieke
 * dienst. Dat hoort niet in een pagina-render.
 *
 * Hervatbaar per constructie: elke uitkomst wordt onmiddellijk weggeschreven, ook een
 * mislukking. Een tweede run vraagt alleen op wat nog ontbreekt — een "niet gevonden" is een
 * bewaarde uitkomst en geen gat, anders bevraagt elke volgende run hem opnieuw.
 *
 * Tempo: één verzoek per seconde, zoals de gebruiksvoorwaarden van Nominatim vragen. Dat is
 * geen schatting van mij maar hun regel; hij staat als constante bovenaan zodat hij te zien
 * en te wijzigen is.
 *
 * Gebruik:
 *   pnpm --filter jobradar geocode            # alles wat nog ontbreekt
 *   pnpm --filter jobradar geocode --status   # alleen tellen, geen netwerk
 *   pnpm --filter jobradar geocode --max=5    # eerst een handvol, om te zien of het werkt
 *   pnpm --filter jobradar geocode --opnieuw  # ook de mislukte opnieuw proberen
 */
import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCHEMA_DDL, pasKolomMigratiesToe } from '../lib/db/ddl'
import { koppelBedrijven } from '../lib/kbo/spiegel'
import { schoneStraat } from '../lib/kbo/adres'

const HIER = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HIER, '..')

const args = process.argv.slice(2)
const heeft = (v) => args.includes(v)
const ALLEEN_STATUS = heeft('--status')
const OPNIEUW = heeft('--opnieuw')
const MAX = Number(args.find((a) => a.startsWith('--max='))?.slice(6) ?? Infinity)

const APP_DB = resolve(APP, process.env.JOBRADAR_DB_PATH ?? join('.data', 'jobradar.db'))
const KBO_DB = resolve(APP, process.env.KBO_DB_PATH ?? join('.data', 'kbo.db'))

const BRON = 'nominatim'
const TEMPO_MS = 1100 // hun voorwaarde is max 1/s; 1,1 s houdt marge
const AGENT = 'jobradar/1.0 (eenmalige geocoding van eigen prospectlijst; jeroen@umanex.be)'

const ok = (s) => console.log(`  ${s}`)
const fout = (s) => console.error(`✗ ${s}`)

/** Zet een KBO-adres om in de gestructureerde velden die Nominatim verwacht. */
function zoekVeldenVan(a) {
  const straat = [a.HouseNumber, schoneStraat(a.StreetNL)].filter(Boolean).join(' ').trim()
  return {
    street: straat,
    city: a.MunicipalityNL ?? '',
    postalcode: a.Zipcode ?? '',
    country: 'Belgium',
  }
}

/** Wat de bron werkelijk vond — een gemeente-treffer is geen huisnummer-treffer. */
function precisieVan(r) {
  const t = r.addresstype ?? r.type ?? ''
  if (['building', 'house', 'residential'].includes(t) || r.address?.house_number) return 'huisnummer'
  if (['road', 'street', 'highway'].includes(t)) return 'straat'
  return 'gemeente'
}

async function vraagOp(velden) {
  const q = new URLSearchParams({ ...velden, format: 'jsonv2', limit: '1', addressdetails: '1' })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
    headers: { 'User-Agent': AGENT, 'Accept-Language': 'nl' },
  })
  if (res.status === 429) return { fout: 'HTTP 429 — te snel bevraagd' }
  if (!res.ok) return { fout: `HTTP ${res.status}` }
  const lijst = await res.json().catch(() => null)
  if (!Array.isArray(lijst) || !lijst.length) return { fout: 'niet gevonden' }
  const r = lijst[0]
  const lat = Number(r.lat)
  const lon = Number(r.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { fout: 'antwoord zonder coördinaten' }
  // België ligt binnen deze doos. Een treffer erbuiten is een verkeerde treffer, geen vondst.
  if (lat < 49.4 || lat > 51.6 || lon < 2.5 || lon > 6.5) {
    return { fout: `treffer buiten België (${lat.toFixed(3)}, ${lon.toFixed(3)})` }
  }
  return { lat, lon, precisie: precisieVan(r) }
}

async function main() {
  if (!existsSync(KBO_DB)) {
    fout(`geen KBO-spiegel op ${KBO_DB} — draai eerst kbo:sync, of zet KBO_DB_PATH`)
    return 2
  }

  const db = new Database(APP_DB)
  db.pragma('journal_mode = WAL')
  db.exec(SCHEMA_DDL)
  pasKolomMigratiesToe(db)

  // ── Wie moet op de kaart? ────────────────────────────────────────────────
  // De aangeleverde lijst, plus de leads die een KBO-vermoeden hebben. Een lead zonder
  // vermoeden heeft geen adres en kan dus niet gegeocodeerd worden — dat is geen fout maar
  // een grens, en de UI meldt hem als teller.
  const uitLijst = db.prepare('SELECT enterprise_number AS nr FROM csv_prospects').all().map((r) => r.nr)
  const leads = db.prepare('SELECT company_name AS naam, region AS regio FROM companies').all()
  process.env.KBO_DB_PATH = KBO_DB
  const vermoedens = koppelBedrijven(leads)
  const uitLeads = [...vermoedens.values()].map((v) => v.nummer)

  const gewenst = [...new Set([...uitLijst, ...uitLeads])]

  const alGoed = new Set(
    db.prepare('SELECT enterprise_number AS nr FROM geocode_cache WHERE lat IS NOT NULL').all().map((r) => r.nr)
  )
  const alMislukt = new Set(
    db.prepare('SELECT enterprise_number AS nr FROM geocode_cache WHERE lat IS NULL').all().map((r) => r.nr)
  )

  const teDoen = gewenst.filter((nr) => !alGoed.has(nr) && (OPNIEUW || !alMislukt.has(nr)))

  ok(`${uitLijst.length} uit de lijst · ${uitLeads.length} leads met een KBO-vermoeden · ${leads.length - uitLeads.length} leads zonder adres`)
  ok(`${gewenst.length} unieke bedrijven · ${alGoed.size} al gegeocodeerd · ${alMislukt.size} eerder mislukt`)
  ok(`${teDoen.length} te doen${Number.isFinite(MAX) ? ` (beperkt tot ${MAX})` : ''}`)

  if (ALLEEN_STATUS) {
    db.close()
    return 0
  }
  if (!teDoen.length) {
    ok('niets te doen')
    db.close()
    return 0
  }

  const kbo = new Database(KBO_DB, { readonly: true, fileMustExist: true })
  const adresVan = kbo.prepare(
    `SELECT Zipcode, MunicipalityNL, StreetNL, HouseNumber FROM address
      WHERE EntityNumber = ? AND TypeOfAddress = 'REGO' LIMIT 1`
  )
  const schrijf = db.prepare(`
    INSERT INTO geocode_cache (enterprise_number, lat, lon, precisie, bron, opgehaald_at, mislukt_reden)
    VALUES (@nr, @lat, @lon, @precisie, @bron, @nu, @reden)
    ON CONFLICT(enterprise_number) DO UPDATE SET
      lat = excluded.lat, lon = excluded.lon, precisie = excluded.precisie,
      bron = excluded.bron, opgehaald_at = excluded.opgehaald_at, mislukt_reden = excluded.mislukt_reden
  `)

  let gelukt = 0
  let mislukt = 0
  const lijst = teDoen.slice(0, Number.isFinite(MAX) ? MAX : teDoen.length)

  for (const [i, nr] of lijst.entries()) {
    const adres = adresVan.get(nr)
    const nu = new Date().toISOString()
    if (!adres) {
      schrijf.run({ nr, lat: null, lon: null, precisie: null, bron: BRON, nu, reden: 'geen zeteladres in de spiegel' })
      mislukt++
      continue
    }

    let uitkomst
    try {
      uitkomst = await vraagOp(zoekVeldenVan(adres))
    } catch (e) {
      uitkomst = { fout: e instanceof Error ? e.message : String(e) }
    }

    if (uitkomst.fout) {
      schrijf.run({ nr, lat: null, lon: null, precisie: null, bron: BRON, nu, reden: uitkomst.fout })
      mislukt++
    } else {
      schrijf.run({ nr, lat: uitkomst.lat, lon: uitkomst.lon, precisie: uitkomst.precisie, bron: BRON, nu, reden: null })
      gelukt++
    }

    if ((i + 1) % 25 === 0 || i + 1 === lijst.length) {
      ok(`${i + 1}/${lijst.length} — ${gelukt} gelukt, ${mislukt} mislukt`)
    }
    // Tempo aanhouden, ook na de laatste: een afgebroken run mag de volgende niet benadelen.
    if (i + 1 < lijst.length) await new Promise((r) => setTimeout(r, TEMPO_MS))
  }

  const perPrecisie = db
    .prepare(`SELECT precisie, count(*) AS n FROM geocode_cache WHERE lat IS NOT NULL GROUP BY precisie`)
    .all()
  ok(`klaar: ${gelukt} gelukt, ${mislukt} mislukt`)
  ok(`cache: ${perPrecisie.map((r) => `${r.n}× ${r.precisie}`).join(', ') || 'leeg'}`)
  kbo.close()
  db.close()
  return 0
}

let code
try {
  code = await main()
} catch (e) {
  fout(e instanceof Error ? e.message : String(e))
  code = 1
}
process.exit(code)
