/**
 * De prospect-selectie als één verklaring.
 *
 * Waarom hier en niet in de query: de selectie is een productbeslissing, geen technisch
 * detail. Wie wil weten wat een prospect ís, leest dit bestand — niet een WHERE-clausule
 * die verspreid staat over een route, een component en een script. De TC-EBC
 * `briefings/2026-08-29-feature-kbo-prospects.tcebc.md` draagt het waarom.
 *
 * Bewust géén databaseverbinding in dit bestand: het bouwt SQL en parameters, meer niet.
 * Daardoor kan de scenario-suite de selectie toetsen zonder een spiegel van 3,6 GB.
 */
import { REGIONS, type RegionCode } from '../regions'

/**
 * NACE 2025, hoofdactiviteit. Keuze van Jeroen op 2026-08-29, gemeten op extract 466:
 * 62100 (4.667) · 62200 (8.902) · 62900 (923) · 58290 (356) · 63910 (331) · 58210 (30).
 * De unie is 14.613 en niet de optelsom 15.209, want 97 ondernemingen dragen er twee.
 *
 * 62200 is met bijna twee derde de grootste groep en tegelijk de minst product-achtige
 * (consultancy en beheer van computerfaciliteiten). Die eruit halen levert 6.107 over —
 * één regel hier, mocht het tabblad daarnaar vragen.
 */
export const PROSPECT_NACE = ['62100', '62200', '62900', '58290', '63910', '58210'] as const

/**
 * Verkorte NL-labels voor de kaart. De officiële omschrijvingen uit `code.csv` zijn tot
 * negentig tekens lang ("Activiteiten op het gebied van computerconsultancy en beheer van
 * computerfaciliteiten") en breken de kaartlayout. Alleen de zes uit de selectie staan hier;
 * een code buiten de selectie komt niet op een prospectkaart.
 */
export const NACE_LABEL: Record<string, string> = {
  '62100': 'Programmatuur ontwerpen',
  '62200': 'IT-consultancy en beheer',
  '62900': 'Overige IT-diensten',
  '58290': 'Software uitgeven',
  '63910': 'Webportalen',
  '58210': 'Computerspellen uitgeven',
}

/** De extracts dragen 2003, 2008 én 2025 naast elkaar. 2025 is de vigerende. */
export const NACE_VERSIE = '2025'

/**
 * KBO registreert deze activiteitengroep alleen bij werkgevers. Het is het enige signaal in
 * de dataset dat "heeft personeel" zegt — er is geen personeelsaantal. Van de 14.613 heeft
 * er 2.903 zo'n registratie; de rest is eenmanszaak of vennootschap zonder loonlijst.
 */
export const RSZ_GROEP = '006'

/** Zetel-adres. Gemeten: ondernemingen hebben er precies één, en altijd van dit type. */
export const ZETEL = 'REGO'

export const NAAM = '001'
export const HANDELSNAAM = '003'
export const NEDERLANDS = '2'

export const PAGINA_GROOTTE = 60

/**
 * Vanaf hier noemen we de spiegel verouderd; de bron levert elke dag een nieuwe extract.
 *
 * Staat hier en niet in `spiegel.ts`: dat bestand begint met `import 'server-only'`, dus een
 * client component kan er niets uit halen. De drempel stond daardoor als kale 7 in de UI
 * naast een constante die niemand las — twee plekken die uit elkaar kunnen lopen zonder dat
 * iets protesteert.
 */
export const VEROUDERD_NA_DAGEN = 7

/** Waar een prospect vandaan komt. `beide` is de vereniging, niet de doorsnede. */
export type Herkomst = 'kbo' | 'csv' | 'beide'

export type ProspectFilter = {
  regions: RegionCode[]
  zoek?: string
  /** De RSZ-zeef. Standaard aan; zonder hem is het tabblad grotendeels eenmanszaken. */
  alleenWerkgevers: boolean
  /** Welke bron(nen). Standaard `beide`. */
  herkomst: Herkomst
  /**
   * Zeeft op `ebitda > 0`. Standaard uit: hij verbergt 44 van de 218 CSV-rijen, en een
   * lijst die stil een vijfde van zichzelf wegneemt is precies de afkapping-zonder-melding
   * die deze app elders vermijdt. Een KBO-rij draagt géén EBITDA, dus met de zeef aan
   * verdwijnt die herkomst volledig — dat is bedoeld, en de UI zegt het.
   */
  alleenWinstgevend: boolean
  /**
   * Waarop de lijst geordend wordt.
   *
   * `oprichting` is de standaard en het bestaande gedrag. De twee andere bestaan omdat de
   * aangeleverde lijst anders onvindbaar is: gemeten 2026-09-08 landen de 213 CSV-bedrijven
   * in de `beide`-selectie op rang 221 tot 2916 van 2939 — de eerste staat op pagina 4 van
   * 49, omdat ze ouder zijn dan de nieuwste KBO-inschrijvingen. Een bron die je zelf
   * importeert en dan niet ziet, is geen bron.
   */
  sortering: Sortering
  /** 1-gebaseerd. */
  pagina: number
}

export type Sortering = 'oprichting' | 'omvang' | 'ebitda'

/**
 * De ORDER BY per sortering. Altijd met `e.EnterpriseNumber` als laatste sleutel: zonder
 * die vaste tiebreak mag SQLite gelijke waarden per query anders ordenen, en dan verschuift
 * een rij tussen pagina 2 en 3 zonder dat er iets veranderd is.
 *
 * `DESC` zet NULL in SQLite achteraan, dus een KBO-rij zonder cijfers zakt vanzelf naar
 * onderen in plaats van de kop van de lijst te bezetten.
 */
const ORDENING: Record<Sortering, string> = {
  oprichting: 'e.StartDate DESC, e.EnterpriseNumber',
  omvang: 'cp.employee_count DESC, e.StartDate DESC, e.EnterpriseNumber',
  ebitda: 'cp.ebitda DESC, e.StartDate DESC, e.EnterpriseNumber',
}

export type ProspectRij = {
  nummer: string
  naam: string
  handelsnaam: string | null
  opgericht: string | null
  postcode: string | null
  gemeente: string | null
  /** Komma-gescheiden NACE-codes uit de selectie; de kaart splitst ze. */
  codes: string | null
  website: string | null
  werkgever: number
  /** 1 wanneer dit bedrijf ook in de aangeleverde CSV staat. SQLite kent geen boolean. */
  uitCsv: number
  /**
   * De CSV-kolommen. Allemaal nullable, want een KBO-rij draagt ze niet — en `null` is hier
   * "niet bekend", nooit nul: 44 rijen hebben een lege `ondernemingswaarde` omdat hun EBITDA
   * negatief is en de multiple dan niet toepasbaar.
   */
  csvNaam: string | null
  werknemers: number | null
  ebitda: number | null
  multiple: number | null
  ondernemingswaarde: number | null
  eigenVermogen: number | null
}

/** `(zip BETWEEN ? AND ? OR …)` voor de gekozen regio's, plus de parameters. */
function regioClausule(regions: RegionCode[]): { sql: string; params: number[] } {
  const gekozen = regions.filter((r) => r in REGIONS)
  if (!gekozen.length) {
    // Geen enkele regio gekozen betekent nul resultaten, niet "alles". Een filter dat bij
    // een lege keuze de hele set teruggeeft, is precies andersom dan een gebruiker verwacht.
    return { sql: '0', params: [] }
  }
  const delen: string[] = []
  const params: number[] = []
  for (const code of gekozen) {
    delen.push('(CAST(ad.Zipcode AS INTEGER) BETWEEN ? AND ?)')
    params.push(REGIONS[code].postcodeMin, REGIONS[code].postcodeMax)
  }
  return { sql: `(${delen.join(' OR ')})`, params }
}

const naamSubquery = (type: string) =>
  `(SELECT d.Denomination FROM denomination d
     WHERE d.EntityNumber = e.EnterpriseNumber AND d.TypeOfDenomination = '${type}'
     ORDER BY (d.Language = '${NEDERLANDS}') DESC LIMIT 1)`

/**
 * Bouwt de selectie. `tellen` levert dezelfde WHERE met een COUNT ervoor — twee queries uit
 * één verklaring, zodat de teller en de lijst niet uiteen kunnen lopen.
 */
export function bouwProspectSql(
  filter: ProspectFilter,
  opties: { tellen?: boolean } = {}
): { sql: string; params: unknown[] } {
  // Parameters zijn positioneel, en de SELECT-lijst staat vóór de WHERE in de string.
  // Twee aparte lijsten die pas aan het eind samenkomen, want anders hangt de volgorde af
  // van de volgorde waarin dit bestand toevallig geschreven is.
  const selectParams: unknown[] = []
  const params: unknown[] = []
  const waar: string[] = ["e.Status = 'AC'"]

  const codes = PROSPECT_NACE
  const naceZeef = `EXISTS (SELECT 1 FROM activity a
       WHERE a.EntityNumber = e.EnterpriseNumber
         AND a.NaceVersion = ?
         AND a.Classification = 'MAIN'
         AND a.NaceCode IN (${codes.map(() => '?').join(', ')}))`

  // De herkomst beslist wélke zeef geldt, niet of er nog een filter bovenop komt.
  //
  // Voor `csv` valt de NACE-zeef weg, en dat is de bedoeling: de aangeleverde lijst draagt
  // 40 verschillende hoofdactiviteiten waarvan er maar 178 van de 218 binnen de zes codes
  // van het KBO-universum vallen (gemeten 2026-09-08). Wie de zeef laat staan, verliest
  // veertig bedrijven die de gebruiker zelf heeft uitgekozen — stil, want de lijst toont
  // gewoon een kleiner getal.
  if (filter.herkomst === 'kbo') {
    waar.push(naceZeef)
    params.push(NACE_VERSIE, ...codes)
  } else if (filter.herkomst === 'csv') {
    waar.push('cp.enterprise_number IS NOT NULL')
  } else {
    waar.push(`(${naceZeef} OR cp.enterprise_number IS NOT NULL)`)
    params.push(NACE_VERSIE, ...codes)
  }

  const regio = regioClausule(filter.regions)
  waar.push(regio.sql)
  params.push(...regio.params)

  if (filter.alleenWerkgevers) {
    waar.push(`EXISTS (SELECT 1 FROM activity r WHERE r.EntityNumber = e.EnterpriseNumber AND r.ActivityGroup = ?)`)
    params.push(RSZ_GROEP)
  }

  if (filter.alleenWinstgevend) {
    // `NULL > 0` is in SQL niet waar maar onbekend, en onbekend zeeft weg. Een KBO-rij
    // zonder CSV-tegenhanger valt hier dus vanzelf uit — precies wat bedoeld is.
    waar.push('cp.ebitda > 0')
  }

  const term = filter.zoek?.trim()
  if (term) {
    waar.push(
      `(EXISTS (SELECT 1 FROM denomination dz
         WHERE dz.EntityNumber = e.EnterpriseNumber AND dz.Denomination LIKE ? COLLATE NOCASE)
        OR cp.name LIKE ? COLLATE NOCASE)`
    )
    params.push(`%${term}%`, `%${term}%`)
  }

  // De LEFT JOIN staat in `van` en niet in de SELECT, zodat teller en lijst hem allebei
  // dragen. Zonder dat zou `cp.…` in de WHERE van de telling een onbekende kolom zijn.
  const van = `FROM enterprise e
      JOIN address ad ON ad.EntityNumber = e.EnterpriseNumber AND ad.TypeOfAddress = '${ZETEL}'
      LEFT JOIN jr.csv_prospects cp ON cp.enterprise_number = e.EnterpriseNumber
     WHERE ${waar.join('\n       AND ')}`

  if (opties.tellen) {
    return { sql: `SELECT COUNT(*) AS n ${van}`, params }
  }

  // De codes verschijnen een tweede keer, nu in de SELECT-lijst.
  selectParams.push(...codes)

  const pagina = Math.max(1, Math.trunc(filter.pagina || 1))
  const paginaParams = [PAGINA_GROOTTE, (pagina - 1) * PAGINA_GROOTTE]

  return {
    sql: `SELECT e.EnterpriseNumber AS nummer,
             ${naamSubquery(NAAM)} AS naam,
             ${naamSubquery(HANDELSNAAM)} AS handelsnaam,
             e.StartDate AS opgericht,
             ad.Zipcode AS postcode,
             ad.MunicipalityNL AS gemeente,
             (SELECT group_concat(DISTINCT a2.NaceCode) FROM activity a2
               WHERE a2.EntityNumber = e.EnterpriseNumber
                 AND a2.NaceVersion = '${NACE_VERSIE}' AND a2.Classification = 'MAIN'
                 AND a2.NaceCode IN (${codes.map(() => '?').join(', ')})) AS codes,
             (SELECT c.Value FROM contact c
               WHERE c.EntityNumber = e.EnterpriseNumber AND c.ContactType = 'WEB' LIMIT 1) AS website,
             EXISTS (SELECT 1 FROM activity r
               WHERE r.EntityNumber = e.EnterpriseNumber AND r.ActivityGroup = '${RSZ_GROEP}') AS werkgever,
             (cp.enterprise_number IS NOT NULL) AS uitCsv,
             cp.name AS csvNaam,
             cp.employee_count AS werknemers,
             cp.ebitda AS ebitda,
             cp.valuation_multiple AS multiple,
             cp.enterprise_value AS ondernemingswaarde,
             cp.equity_value AS eigenVermogen
        ${van}
        ORDER BY ${ORDENING[filter.sortering] ?? ORDENING.oprichting}
        LIMIT ? OFFSET ?`,
    params: [...selectParams, ...params, ...paginaParams],
  }
}

/**
 * Telt de CSV-rijen die géén KBO-tegenhanger hebben en dus buiten `bouwProspectSql` vallen.
 *
 * Die query vertrekt van `enterprise`, dus een bedrijf dat niet in de spiegel staat kan er
 * per constructie niet in voorkomen — gemeten op het geleverde bestand zijn dat er 3. Ze
 * dragen ook geen postcode, en het regiofilter is een harde `WHERE` op `ad.Zipcode`, dus ze
 * kunnen geen enkele regioselectie passeren. Stil weglaten is precies de faalklasse die deze
 * app vermijdt; daarom komen ze hier als telling terug en meldt de UI ze boven de lijst.
 */
export function bouwZonderKboSql(filter: ProspectFilter): { sql: string; params: unknown[] } {
  // Bij herkomst `kbo` kijkt de gebruiker bewust niet naar de aangeleverde lijst. Rijen die
  // daarbuiten vallen zijn dan geen weggelaten resultaat maar een andere vraag, en een
  // melding erover is ruis die de echte melding devalueert.
  if (filter.herkomst === 'kbo') return { sql: 'SELECT 0 AS n', params: [] }

  const waar = ['NOT EXISTS (SELECT 1 FROM enterprise e WHERE e.EnterpriseNumber = cp.enterprise_number)']
  const params: unknown[] = []

  if (filter.alleenWinstgevend) waar.push('cp.ebitda > 0')

  const term = filter.zoek?.trim()
  if (term) {
    waar.push('cp.name LIKE ? COLLATE NOCASE')
    params.push(`%${term}%`)
  }

  return { sql: `SELECT COUNT(*) AS n FROM jr.csv_prospects cp WHERE ${waar.join(' AND ')}`, params }
}

/** Jaren sinds oprichting, of null wanneer KBO geen datum heeft. */
export function leeftijdInJaren(opgericht: string | null, vandaag: string): number | null {
  if (!opgericht) return null
  const start = Date.parse(opgericht)
  const nu = Date.parse(vandaag)
  if (Number.isNaN(start) || Number.isNaN(nu)) return null
  return Math.floor((nu - start) / (365.2425 * 24 * 60 * 60 * 1000))
}
