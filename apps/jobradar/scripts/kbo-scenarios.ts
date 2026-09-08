/**
 * Invarianten op de KBO-leeslaag.
 *
 * De faalmodus die deze suite bewaakt is stil: een CSV-parser die een komma of een quote
 * verkeerd leest, gooit niets — hij schuift de kolommen op en levert een rij die er goed
 * uitziet. Gemeten in één dagdelta: 6 270 velden met een komma binnen quotes en 33 velden
 * met een geëscapete quote. Eén verkeerde aanname daar zet een NACE-code in het
 * classificatieveld en niemand ziet het.
 *
 * De scherpste check hier is `chunkgroottes`: dezelfde invoer in stukjes van 1 tot 7 bytes
 * moet exact dezelfde rijen opleveren. De parser is een toestandsmachine over brokken, en
 * een quote die precies op een brokgrens valt is de klassieke breuk — met een 313 MB
 * bestand ligt elke grens ergens.
 *
 * Draaien: node --import ./scripts/ts-resolve.mjs scripts/kbo-scenarios.ts
 */
import { existsSync, readdirSync, createReadStream } from 'node:fs'
import { join } from 'node:path'
import { csvRijen, csvObjecten, kboDatum, kboNummer } from '../lib/kbo/csv'
import Database from 'better-sqlite3'
import {
  bouwNaamIndex,
  koppelSleutel,
  zoekOnderneming,
  MIN_SLEUTELLENGTE,
  NAAM_INDEX_DDL,
} from '../lib/kbo/koppeling'
import {
  bouwProspectSql,
  bouwZonderKboSql,
  leeftijdInJaren,
  NACE_VERSIE,
  type ProspectFilter,
  NACE_LABEL,
  PROSPECT_NACE,
  PAGINA_GROOTTE,
} from '../lib/kbo/universum'

let geslaagd = 0
let gezakt = 0
const notities: string[] = []

function check(naam: string, voorwaarde: boolean, detail = ''): void {
  if (voorwaarde) geslaagd++
  else {
    gezakt++
    console.error(`  FAIL  ${naam}${detail ? ` — ${detail}` : ''}`)
  }
}

function notitie(tekst: string): void {
  notities.push(tekst)
}

/** Levert een string als async-iterable in brokken van n tekens. */
async function* inBrokken(tekst: string, n: number): AsyncGenerator<string> {
  for (let i = 0; i < tekst.length; i += n) yield tekst.slice(i, i + n)
}

async function rijen(tekst: string, brokgrootte = 1024): Promise<string[][]> {
  const uit: string[][] = []
  for await (const r of csvRijen(inBrokken(tekst, brokgrootte))) uit.push(r)
  return uit
}

const gelijk = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// ── 1. De grammatica ─────────────────────────────────────────────────────────
{
  check('kale velden', gelijk(await rijen('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]))

  check(
    'komma binnen quotes blijft één veld',
    gelijk(await rijen('"x","y,z"\n'), [['x', 'y,z']]),
    JSON.stringify(await rijen('"x","y,z"\n'))
  )

  check('"" is één letterlijke quote', gelijk(await rijen('"a""b"\n'), [['a"b']]))

  check('lege velden tellen mee', gelijk(await rijen('a,,c\n'), [['a', '', 'c']]))

  check('leeg gequoot veld', gelijk(await rijen('"",""\n'), [['', '']]))

  check('CRLF', gelijk(await rijen('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]))

  check(
    'newline binnen quotes breekt de rij niet',
    gelijk(await rijen('"regel1\nregel2",x\n'), [['regel1\nregel2', 'x']])
  )

  check('laatste rij zonder newline', gelijk(await rijen('a,b\n1,2'), [['a', 'b'], ['1', '2']]))

  check('lege regels aan het eind leveren geen rij', gelijk(await rijen('a\n\n'), [['a']]))

  // Precies de vorm die KBO gebruikt: gequote tekst naast een kale datum.
  check(
    'gemengde quoting zoals in enterprise_insert',
    gelijk(await rijen('"0417.238.867","AC","050","2","014",,29-01-1977\n'), [
      ['0417.238.867', 'AC', '050', '2', '014', '', '29-01-1977'],
    ])
  )
}

// ── 2. Brokgrenzen ───────────────────────────────────────────────────────────
// Dit is de tegenproef op de toestandsmachine zelf: het resultaat mag niet afhangen van
// wáár de stream toevallig geknipt wordt.
{
  const lastig = '"Category","Code"\n"Nace2008","Handel, groot- en kleinhandel"\n"x","a""b"\n"y","regel\nover twee"\n'
  const referentie = await rijen(lastig, 4096)
  let allemaalGelijk = true
  for (let n = 1; n <= 7; n++) {
    if (!gelijk(await rijen(lastig, n), referentie)) {
      allemaalGelijk = false
      check(`brokgrootte ${n} geeft hetzelfde resultaat`, false, JSON.stringify(await rijen(lastig, n)))
    }
  }
  check('chunkgroottes 1..7 leveren identieke rijen', allemaalGelijk)
  check('referentie heeft de verwachte 4 rijen', referentie.length === 4, `${referentie.length}`)
}

// ── 3. Objecten en de kolomtelling als harde grens ───────────────────────────
{
  const uit: Record<string, string>[] = []
  for await (const o of csvObjecten(inBrokken('a,b\n1,2\n3,4\n', 3), 'test')) uit.push(o)
  check('csvObjecten mapt op de kopregel', gelijk(uit, [{ a: '1', b: '2' }, { a: '3', b: '4' }]))

  let gegooid = false
  try {
    for await (const _ of csvObjecten(inBrokken('a,b\n1,2,3\n', 3), 'test')) void _
  } catch {
    gegooid = true
  }
  check('een rij met te veel velden gooit', gegooid)

  let gegooid2 = false
  try {
    for await (const _ of csvObjecten(inBrokken('a,b\n1\n', 3), 'test')) void _
  } catch {
    gegooid2 = true
  }
  check('een rij met te weinig velden gooit', gegooid2)
}

// ── 4. Datums en nummers ─────────────────────────────────────────────────────
{
  check('DD-MM-YYYY wordt ISO', kboDatum('29-01-1977') === '1977-01-29')
  check('leeg is null, geen fout', kboDatum('') === null)
  check('spaties tellen als leeg', kboDatum('   ') === null)

  for (const slecht of ['1977-01-29', '29/01/1977', '9-1-1977', 'gisteren']) {
    let gooit = false
    try {
      kboDatum(slecht)
    } catch {
      gooit = true
    }
    check(`"${slecht}" wordt geweigerd i.p.v. stil null`, gooit)
  }

  check('ondernemingsnummer zonder punten', kboNummer('0417.238.867') === '0417238867')
  check('nummer zonder punten blijft gelijk', kboNummer('0417238867') === '0417238867')
}

// ── 5. Tegen de échte extract, als die lokaal staat ──────────────────────────
// `.data/` is gitignored, dus in CI bestaat deze map niet. Dan slaat dit blok over — mét
// een notitie, want een overgeslagen meting die er groen uitziet is erger dan geen meting.
{
  const map = join(process.cwd(), '.data/kbo/update')
  if (!existsSync(map)) {
    notitie(`echte-extract-controle overgeslagen: ${map} bestaat niet (verwacht in CI)`)
  } else {
    const bestanden = readdirSync(map).filter((b) => b.endsWith('.csv'))
    check('er staan CSV-bestanden in de uitgepakte delta', bestanden.length > 0, `${bestanden.length}`)

    for (const naam of bestanden) {
      const pad = join(map, naam)
      let kop: string[] | null = null
      let rijenGeteld = 0
      let scheef = 0
      for await (const rij of csvRijen(createReadStream(pad))) {
        if (kop === null) {
          kop = rij
          continue
        }
        rijenGeteld++
        if (rij.length !== kop.length) scheef++
      }
      check(`${naam}: elke rij heeft ${kop?.length ?? 0} velden`, scheef === 0, `${scheef} scheve rijen`)
      check(`${naam}: minstens één datarij gelezen`, rijenGeteld > 0 || naam.includes('_delete'), `${rijenGeteld}`)
    }
  }
}

// ── 6. De prospect-selectie ──────────────────────────────────────────────────
// De scherpste check is de eerste: het aantal `?` in de SQL moet gelijk zijn aan het aantal
// parameters. Parameters zijn positioneel, en de SELECT-lijst staat vóór de WHERE — een
// vergeten of dubbel meegegeven waarde schuift stil álles op, en de query blijft geldig.
{
  const basis = {
    regions: ['WVL', 'OVL', 'BRU'] as const,
    alleenWerkgevers: true,
    herkomst: 'beide' as const,
    alleenWinstgevend: false,
    sortering: 'oprichting' as const,
    pagina: 1,
  }
  const varianten = [
    { naam: 'volledig', f: { ...basis, regions: [...basis.regions] } },
    { naam: 'zonder werkgeverszeef', f: { ...basis, regions: [...basis.regions], alleenWerkgevers: false } },
    { naam: 'met zoekterm', f: { ...basis, regions: [...basis.regions], zoek: 'studio' } },
    { naam: 'één regio', f: { ...basis, regions: ['WVL' as const] } },
    { naam: 'geen regio', f: { ...basis, regions: [] } },
    { naam: 'pagina 5', f: { ...basis, regions: [...basis.regions], pagina: 5 } },
    // De herkomst-as verdubbelt de matrix. Ze staat er voluit in en niet als steekproef:
    // elke tak zet een ándere combinatie parameters klaar, en juist daar schuift een
    // vergeten placeholder stil alles op.
    { naam: 'herkomst kbo', f: { ...basis, regions: [...basis.regions], herkomst: 'kbo' as const } },
    { naam: 'herkomst csv', f: { ...basis, regions: [...basis.regions], herkomst: 'csv' as const } },
    { naam: 'herkomst csv + zoekterm', f: { ...basis, regions: [...basis.regions], herkomst: 'csv' as const, zoek: 'studio' } },
    { naam: 'herkomst csv + winstgevend', f: { ...basis, regions: [...basis.regions], herkomst: 'csv' as const, alleenWinstgevend: true } },
    { naam: 'winstgevend', f: { ...basis, regions: [...basis.regions], alleenWinstgevend: true } },
    { naam: 'winstgevend + zoekterm + één regio', f: { ...basis, regions: ['WVL' as const], alleenWinstgevend: true, zoek: 'studio' } },
    { naam: 'sortering omvang', f: { ...basis, regions: [...basis.regions], sortering: 'omvang' as const } },
    { naam: 'sortering ebitda', f: { ...basis, regions: [...basis.regions], sortering: 'ebitda' as const } },
  ]

  for (const { naam, f } of varianten) {
    for (const tellen of [false, true]) {
      const q = bouwProspectSql(f, { tellen })
      const vraagtekens = (q.sql.match(/\?/g) ?? []).length
      check(
        `${naam}${tellen ? ' (telling)' : ''}: ${vraagtekens} placeholders, ${q.params.length} parameters`,
        vraagtekens === q.params.length,
        `${vraagtekens} vs ${q.params.length}`
      )
    }
  }

  // Een lege regiokeuze mag NIET "alles" betekenen. Dat is de klassieke omkering: een filter
  // dat bij nul selecties de hele set teruggeeft.
  const leeg = bouwProspectSql({ ...basis, regions: [] })
  check('geen regio gekozen levert een onmogelijke voorwaarde', / 0\b/.test(leeg.sql), leeg.sql.slice(0, 120))

  const telling = bouwProspectSql({ ...basis, regions: ['WVL'] }, { tellen: true })
  check('telling heeft geen LIMIT', !/LIMIT/.test(telling.sql))
  check('telling telt rijen', /COUNT\(\*\)/.test(telling.sql))

  const lijst = bouwProspectSql({ ...basis, regions: ['WVL'] })
  check('lijst heeft LIMIT en OFFSET', /LIMIT \? OFFSET \?/.test(lijst.sql))
  check(
    `paginagrootte ${PAGINA_GROOTTE} staat in de parameters`,
    lijst.params.includes(PAGINA_GROOTTE)
  )
  const pagina3 = bouwProspectSql({ ...basis, regions: ['WVL'], pagina: 3 })
  check('pagina 3 slaat 2 pagina\'s over', pagina3.params.includes(2 * PAGINA_GROOTTE))
  const pagina0 = bouwProspectSql({ ...basis, regions: ['WVL'], pagina: 0 })
  check('pagina 0 wordt pagina 1, geen negatieve offset', pagina0.params.includes(0))

  const metZoek = bouwProspectSql({ ...basis, regions: ['WVL'], zoek: '  studio  ' })
  check('zoekterm wordt getrimd en met jokers omsloten', metZoek.params.includes('%studio%'))
  const zonderZoek = bouwProspectSql({ ...basis, regions: ['WVL'], zoek: '   ' })
  check('een zoekterm van alleen spaties telt niet mee', !zonderZoek.sql.includes('LIKE'))

  const metRsz = bouwProspectSql({ ...basis, regions: ['WVL'], alleenWerkgevers: true })
  const zonderRsz = bouwProspectSql({ ...basis, regions: ['WVL'], alleenWerkgevers: false })
  check('de werkgeverszeef voegt een voorwaarde toe', metRsz.params.length === zonderRsz.params.length + 1)

  // ── De herkomst-as ─────────────────────────────────────────────────────────
  const kbo = bouwProspectSql({ ...basis, regions: ['WVL'], herkomst: 'kbo' })
  const csv = bouwProspectSql({ ...basis, regions: ['WVL'], herkomst: 'csv' })
  const beide = bouwProspectSql({ ...basis, regions: ['WVL'], herkomst: 'beide' })

  check('herkomst kbo houdt de NACE-zeef', /a\.NaceCode IN/.test(kbo.sql))
  check('herkomst csv laat de NACE-zeef in de WHERE vallen', !/AND EXISTS \(SELECT 1 FROM activity a\b/.test(csv.sql))
  check(
    'herkomst csv eist een CSV-tegenhanger',
    /cp\.enterprise_number IS NOT NULL/.test(csv.sql)
  )
  check(
    'herkomst beide is een OR, geen AND — de vereniging, niet de doorsnede',
    /OR cp\.enterprise_number IS NOT NULL/.test(beide.sql)
  )
  check(
    'herkomst csv geeft minder parameters mee dan kbo (de zes NACE-codes plus de versie)',
    csv.params.length === kbo.params.length - (PROSPECT_NACE.length + 1),
    `csv=${csv.params.length} kbo=${kbo.params.length}`
  )
  check('elke herkomst joint de CSV-tabel, ook de telling', [
    bouwProspectSql({ ...basis, regions: ['WVL'], herkomst: 'kbo' }, { tellen: true }),
    bouwProspectSql({ ...basis, regions: ['WVL'], herkomst: 'csv' }, { tellen: true }),
    bouwProspectSql({ ...basis, regions: ['WVL'], herkomst: 'beide' }, { tellen: true }),
  ].every((q) => /LEFT JOIN jr\.csv_prospects/.test(q.sql)))

  // ── De winstgevendheidszeef, op een echte database ─────────────────────────
  // Deze checks draaien de SQL uit en tellen rijen; ze lezen hem niet.
  //
  // De reden staat in de meting die eraan voorafging (2026-09-08): een string-check op
  // `/cp\.ebitda > 0/` bleef groen toen de zeef werd verbouwd tot
  // `(cp.ebitda > 0 OR cp.ebitda IS NULL)` — de gezochte tekst stond er nog steeds in.
  // De check toetste de náám van de voorwaarde, niet wat ze doet.
  {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE enterprise ("EnterpriseNumber" TEXT PRIMARY KEY, "Status" TEXT, "StartDate" TEXT);
      CREATE TABLE address ("EntityNumber" TEXT, "TypeOfAddress" TEXT, "Zipcode" TEXT, "MunicipalityNL" TEXT);
      CREATE TABLE activity ("EntityNumber" TEXT, "ActivityGroup" TEXT, "NaceVersion" TEXT, "NaceCode" TEXT, "Classification" TEXT);
      CREATE TABLE denomination ("EntityNumber" TEXT, "Language" TEXT, "TypeOfDenomination" TEXT, "Denomination" TEXT);
      CREATE TABLE contact ("EntityNumber" TEXT, "EntityContact" TEXT, "ContactType" TEXT, "Value" TEXT);
      ATTACH DATABASE ':memory:' AS jr;
      CREATE TABLE jr.csv_prospects (
        enterprise_number TEXT PRIMARY KEY, name TEXT, nace_label TEXT, city TEXT,
        employee_count REAL, ebitda REAL, valuation_multiple REAL,
        enterprise_value REAL, equity_value REAL, bestandsnaam TEXT, imported_at TEXT);
    `)

    // Vier bedrijven, elk met precies één eigenschap die ertoe doet.
    const bedrijf = (nr: string, nace: string) => {
      db.prepare(`INSERT INTO enterprise VALUES (?, 'AC', '2020-01-01')`).run(nr)
      db.prepare(`INSERT INTO address VALUES (?, 'REGO', '8000', 'Brugge')`).run(nr)
      db.prepare(`INSERT INTO activity VALUES (?, '006', ?, ?, 'MAIN')`).run(nr, NACE_VERSIE, nace)
      db.prepare(`INSERT INTO denomination VALUES (?, '2', '001', ?)`).run(nr, 'Firma ' + nr)
    }
    const csv = (nr: string, ebitda: number | null) =>
      db.prepare(`INSERT INTO jr.csv_prospects (enterprise_number, name, ebitda, bestandsnaam, imported_at)
                  VALUES (?, ?, ?, 'x', 'x')`).run(nr, 'Firma ' + nr, ebitda)

    bedrijf('1000000001', '62100')   // in de NACE-zeef, geen CSV
    bedrijf('1000000002', '62100')   // in de zeef, CSV met winst
    bedrijf('1000000003', '62100')   // in de zeef, CSV met verlies
    bedrijf('1000000004', '10710')   // BUITEN de zeef (bakkerij), CSV met winst
    csv('1000000002', 5000)
    csv('1000000003', -5000)
    csv('1000000004', 7000)

    const tel = (f: Partial<ProspectFilter>) => {
      const q = bouwProspectSql({ ...basis, regions: ['WVL'], ...f }, { tellen: true })
      return (db.prepare(q.sql).get(...(q.params as never[])) as { n: number }).n
    }

    check('herkomst kbo telt alleen wat in de NACE-zeef zit', tel({ herkomst: 'kbo' }) === 3, String(tel({ herkomst: 'kbo' })))
    check('herkomst csv telt alle CSV-rijen, ook buiten de zeef', tel({ herkomst: 'csv' }) === 3, String(tel({ herkomst: 'csv' })))
    check('herkomst beide is de vereniging, geen dubbeltelling', tel({ herkomst: 'beide' }) === 4, String(tel({ herkomst: 'beide' })))
    check(
      'de winstzeef verwijdert het verlieslatende bedrijf',
      tel({ herkomst: 'csv', alleenWinstgevend: true }) === 2,
      String(tel({ herkomst: 'csv', alleenWinstgevend: true }))
    )
    check(
      'de winstzeef verwijdert óók de KBO-rijen zonder EBITDA — NULL is geen winst',
      tel({ herkomst: 'beide', alleenWinstgevend: true }) === 2,
      String(tel({ herkomst: 'beide', alleenWinstgevend: true }))
    )

    const winst = bouwProspectSql({ ...basis, regions: ['WVL'], alleenWinstgevend: true })
    const geenWinst = bouwProspectSql({ ...basis, regions: ['WVL'], alleenWinstgevend: false })
    check(
      'de winstzeef voegt géén parameter toe — de drempel is een literal',
      winst.params.length === geenWinst.params.length,
      `${winst.params.length} vs ${geenWinst.params.length}`
    )

    db.close()
  }

  // ── De zoekterm zoekt nu in twee bronnen ───────────────────────────────────
  const zoekBeide = bouwProspectSql({ ...basis, regions: ['WVL'], zoek: 'studio' })
  check(
    'een zoekterm zoekt in de KBO-benaming én in de CSV-naam',
    (zoekBeide.params.filter((v) => v === '%studio%')).length === 2,
    String(zoekBeide.params.filter((v) => v === '%studio%').length)
  )

  // ── De rijen buiten de spiegel ─────────────────────────────────────────────
  for (const f of [
    { ...basis, regions: [...basis.regions] },
    { ...basis, regions: [...basis.regions], zoek: 'studio' },
    { ...basis, regions: [...basis.regions], alleenWinstgevend: true },
  ]) {
    const q = bouwZonderKboSql(f)
    const vraagtekens = (q.sql.match(/\?/g) ?? []).length
    check(
      `zonder-KBO-telling: ${vraagtekens} placeholders, ${q.params.length} parameters`,
      vraagtekens === q.params.length,
      `${vraagtekens} vs ${q.params.length}`
    )
  }
  const buiten = bouwZonderKboSql({ ...basis, regions: [...basis.regions] })
  check('de zonder-KBO-telling kent geen regiofilter', !/Zipcode/.test(buiten.sql))
  {
    // Bij herkomst `kbo` is de melding niet van toepassing: dan kijkt de gebruiker bewust
    // niet naar de aangeleverde lijst.
    const db = new Database(':memory:')
    db.exec(`ATTACH DATABASE ':memory:' AS jr;
      CREATE TABLE enterprise ("EnterpriseNumber" TEXT PRIMARY KEY);
      CREATE TABLE jr.csv_prospects (enterprise_number TEXT PRIMARY KEY, name TEXT, ebitda REAL);
      INSERT INTO jr.csv_prospects VALUES ('9999999999', 'Buiten de spiegel', 100);`)
    const tel = (herkomst: 'kbo' | 'csv' | 'beide') => {
      const q = bouwZonderKboSql({ ...basis, regions: [...basis.regions], herkomst })
      return (db.prepare(q.sql).get(...(q.params as never[])) as { n: number }).n
    }
    check('herkomst csv telt de rij buiten de spiegel', tel('csv') === 1, String(tel('csv')))
    check('herkomst beide telt hem ook', tel('beide') === 1, String(tel('beide')))
    check('herkomst kbo telt hem niet — dan is de melding ruis', tel('kbo') === 0, String(tel('kbo')))
    db.close()
  }
  check(
    'de zonder-KBO-telling sluit alles uit wat wél in de spiegel staat',
    /NOT EXISTS \(SELECT 1 FROM enterprise/.test(buiten.sql)
  )

  // ── De ordening ────────────────────────────────────────────────────────────
  // Gedragschecks op de fixture-database: de volgorde die eruit komt, niet de string die
  // erin staat. Dezelfde les als bij de winstzeef.
  {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE enterprise ("EnterpriseNumber" TEXT PRIMARY KEY, "Status" TEXT, "StartDate" TEXT);
      CREATE TABLE address ("EntityNumber" TEXT, "TypeOfAddress" TEXT, "Zipcode" TEXT, "MunicipalityNL" TEXT);
      CREATE TABLE activity ("EntityNumber" TEXT, "ActivityGroup" TEXT, "NaceVersion" TEXT, "NaceCode" TEXT, "Classification" TEXT);
      CREATE TABLE denomination ("EntityNumber" TEXT, "Language" TEXT, "TypeOfDenomination" TEXT, "Denomination" TEXT);
      CREATE TABLE contact ("EntityNumber" TEXT, "EntityContact" TEXT, "ContactType" TEXT, "Value" TEXT);
      ATTACH DATABASE ':memory:' AS jr;
      CREATE TABLE jr.csv_prospects (
        enterprise_number TEXT PRIMARY KEY, name TEXT, nace_label TEXT, city TEXT,
        employee_count REAL, ebitda REAL, valuation_multiple REAL,
        enterprise_value REAL, equity_value REAL, bestandsnaam TEXT, imported_at TEXT);
    `)
    const zet = (nr: string, start: string, werknemers: number | null, ebitda: number | null) => {
      db.prepare(`INSERT INTO enterprise VALUES (?, 'AC', ?)`).run(nr, start)
      db.prepare(`INSERT INTO address VALUES (?, 'REGO', '8000', 'Brugge')`).run(nr)
      db.prepare(`INSERT INTO activity VALUES (?, '006', ?, '62100', 'MAIN')`).run(nr, NACE_VERSIE)
      if (werknemers !== null) {
        db.prepare(`INSERT INTO jr.csv_prospects (enterprise_number, name, employee_count, ebitda, bestandsnaam, imported_at)
                    VALUES (?, ?, ?, ?, 'x', 'x')`).run(nr, 'Firma ' + nr, werknemers, ebitda)
      }
    }
    // Het jóngste bedrijf is het kléinste, zodat elke sortering een andere kop geeft.
    zet('2000000001', '2024-01-01', 5, 100)      // jongst, klein, lage ebitda
    zet('2000000002', '2010-01-01', 50, 900)     // oudst, grootst, hoogste ebitda
    zet('2000000003', '2015-01-01', 20, 400)
    zet('2000000004', '2012-01-01', null, null)  // alleen KBO, geen cijfers

    const eerste = (sortering: 'oprichting' | 'omvang' | 'ebitda') => {
      const q = bouwProspectSql({ ...basis, regions: ['WVL'], sortering })
      const rijen = db.prepare(q.sql).all(...(q.params as never[])) as { nummer: string }[]
      return rijen[0]?.nummer
    }
    check('sortering oprichting zet het jongste bedrijf bovenaan', eerste('oprichting') === '2000000001', String(eerste('oprichting')))
    check('sortering omvang zet het grootste bovenaan', eerste('omvang') === '2000000002', String(eerste('omvang')))
    check('sortering ebitda zet de hoogste bovenaan', eerste('ebitda') === '2000000002', String(eerste('ebitda')))

    const laatste = (sortering: 'omvang' | 'ebitda') => {
      const q = bouwProspectSql({ ...basis, regions: ['WVL'], sortering })
      const rijen = db.prepare(q.sql).all(...(q.params as never[])) as { nummer: string }[]
      return rijen[rijen.length - 1]?.nummer
    }
    check('een rij zonder cijfers zakt naar onderen bij omvang', laatste('omvang') === '2000000004', String(laatste('omvang')))
    check('een rij zonder cijfers zakt naar onderen bij ebitda', laatste('ebitda') === '2000000004', String(laatste('ebitda')))

    // Zonder vaste tiebreak mag SQLite gelijke waarden per query anders ordenen.
    for (const s of ['oprichting', 'omvang', 'ebitda'] as const) {
      const q = bouwProspectSql({ ...basis, regions: ['WVL'], sortering: s })
      // Ankeren op de LÁÁTSTE `ORDER BY`: de naam-subquery draagt er zelf ook een, dus
      // `split('ORDER BY')[1]` levert die van de denominatie in plaats van die van de
      // lijst — en dan meet je een andere clausule dan je denkt (gemeten 2026-09-08).
      const delen = q.sql.split('ORDER BY')
      const clausule = (delen[delen.length - 1] ?? '').split('LIMIT')[0]!.trim()
      check(
        `sortering ${s} eindigt op een unieke tiebreak`,
        clausule.endsWith('e.EnterpriseNumber'),
        `laatste ORDER BY: "${clausule}"`
      )
    }

    // Een onbekende waarde mag niet in de SQL belanden.
    const onzin = bouwProspectSql({ ...basis, regions: ['WVL'], sortering: 'drop table' as never })
    check('een onbekende sortering valt terug op oprichting', /e\.StartDate DESC/.test(onzin.sql) && !/drop table/i.test(onzin.sql))

    db.close()
  }

  for (const code of PROSPECT_NACE) {
    check(`NACE ${code} heeft een label voor de kaart`, typeof NACE_LABEL[code] === 'string')
  }
  check(
    'er staan geen labels voor codes buiten de selectie',
    Object.keys(NACE_LABEL).every((c) => (PROSPECT_NACE as readonly string[]).includes(c))
  )

  check('leeftijd: 2020-01-01 op 2026-01-01 is 6 jaar', leeftijdInJaren('2020-01-01', '2026-01-01') === 6)
  check('leeftijd: vandaag opgericht is 0 jaar', leeftijdInJaren('2026-08-29', '2026-08-29') === 0)
  check('leeftijd zonder datum is null', leeftijdInJaren(null, '2026-08-29') === null)
  check('leeftijd met onzin is null', leeftijdInJaren('ooit', '2026-08-29') === null)
}

// ── 7. De koppeling naam → ondernemingsnummer ────────────────────────────────
// De regel die deze suite bewaakt is één zin: liever geen koppeling dan een verkeerde. Een
// versoepeling — "pak de eerste kandidaat" — is een wijziging van twee tekens die niets
// stukmaakt wat een typecheck ziet, en die een lead aan de verkeerde onderneming plakt.
{
  check('sleutel: rechtsvorm valt weg', koppelSleutel('Acme BV') === 'acme')
  check('sleutel: hoofdletters en leestekens', koppelSleutel('ACME, N.V.') === 'acme')
  check('sleutel: meervoudige spaties worden er één', koppelSleutel('Acme   Group') === 'acme group')
  check('sleutel: punten verdwijnen', koppelSleutel('Collective.work') === 'collectivework')
  check('sleutel: N.V. telt als rechtsvorm', koppelSleutel('Acme N.V.') === 'acme')

  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE enterprise (EnterpriseNumber TEXT PRIMARY KEY, Status TEXT, StartDate TEXT);
    CREATE TABLE denomination (EntityNumber TEXT, Language TEXT, TypeOfDenomination TEXT, Denomination TEXT);
    CREATE TABLE address (EntityNumber TEXT, TypeOfAddress TEXT, Zipcode TEXT, MunicipalityNL TEXT);
    ${NAAM_INDEX_DDL}
  `)
  const onderneming = db.prepare('INSERT INTO enterprise VALUES (?,?,?)')
  const benaming = db.prepare("INSERT INTO denomination VALUES (?,'2','001',?)")
  const adres = db.prepare("INSERT INTO address VALUES (?,'REGO',?,?)")

  onderneming.run('0000000001', 'AC', '2010-01-01')
  benaming.run('0000000001', 'Uniek Bedrijf BV')
  adres.run('0000000001', '8000', 'Brugge')

  // Twee ondernemingen met exact dezelfde genormaliseerde naam, in verschillende regio's.
  onderneming.run('0000000002', 'AC', '2011-01-01')
  benaming.run('0000000002', 'Dubbel NV')
  adres.run('0000000002', '9000', 'Gent')
  onderneming.run('0000000003', 'AC', '2012-01-01')
  benaming.run('0000000003', 'Dubbel BV')
  adres.run('0000000003', '1000', 'Brussel')

  // Twee met dezelfde naam ín dezelfde regio: ook regio breekt dit gelijkspel niet.
  onderneming.run('0000000004', 'AC', '2013-01-01')
  benaming.run('0000000004', 'Tweeling BV')
  adres.run('0000000004', '8000', 'Brugge')
  onderneming.run('0000000005', 'AC', '2014-01-01')
  benaming.run('0000000005', 'Tweeling NV')
  adres.run('0000000005', '8500', 'Kortrijk')

  // Stopgezet: mag nooit gekoppeld worden.
  onderneming.run('0000000006', 'ST', '2000-01-01')
  benaming.run('0000000006', 'Gestopt Bedrijf BV')
  adres.run('0000000006', '9000', 'Gent')

  // Te korte sleutel.
  onderneming.run('0000000007', 'AC', '2015-01-01')
  benaming.run('0000000007', 'AB BV')
  adres.run('0000000007', '9000', 'Gent')

  const gebouwd = bouwNaamIndex(db)
  // Zes actieve ondernemingen, waarvan er één een te korte naam heeft: vijf in de index.
  check('index bevat de koppelbare actieve ondernemingen', gebouwd === 5, `${gebouwd}`)
  const inIndex = (nr: string) =>
    (db.prepare('SELECT COUNT(*) AS n FROM naam_index WHERE EntityNumber = ?').get(nr) as { n: number }).n
  check('stopgezette onderneming staat niet in de index', inIndex('0000000006') === 0)
  check('te korte naam staat niet in de index', inIndex('0000000007') === 0)

  const uniek = zoekOnderneming(db, 'Uniek Bedrijf')
  check('unieke naam koppelt', uniek.soort === 'gevonden' && uniek.nummer === '0000000001')
  check('unieke naam koppelt zonder regio nodig te hebben', uniek.soort === 'gevonden' && !uniek.viaRegio)

  const zonderRegio = zoekOnderneming(db, 'Dubbel')
  check('twee kandidaten zonder regio: GEEN keuze', zonderRegio.soort === 'meerdere', zonderRegio.soort)
  check(
    'en beide kandidaten worden gemeld',
    zonderRegio.soort === 'meerdere' && zonderRegio.kandidaten.length === 2
  )

  const metRegio = zoekOnderneming(db, 'Dubbel', 'OVL')
  check('regio breekt het gelijkspel', metRegio.soort === 'gevonden' && metRegio.nummer === '0000000002')
  check('en dat wordt als zodanig gemeld', metRegio.soort === 'gevonden' && metRegio.viaRegio)

  const zelfdeRegio = zoekOnderneming(db, 'Tweeling', 'WVL')
  check('twee kandidaten in dezelfde regio: nog steeds GEEN keuze', zelfdeRegio.soort === 'meerdere', zelfdeRegio.soort)

  const gestopt = zoekOnderneming(db, 'Gestopt Bedrijf')
  check('een stopgezette onderneming koppelt niet', gestopt.soort === 'geen')

  const kort = zoekOnderneming(db, 'AB')
  check('een te korte naam koppelt niet', kort.soort === 'geen' && kort.reden === 'te-kort')
  check(`minimumlengte is ${MIN_SLEUTELLENGTE}`, MIN_SLEUTELLENGTE >= 4)

  const onbekend = zoekOnderneming(db, 'Bestaat Niet In Deze Index')
  check('onbekende naam koppelt niet', onbekend.soort === 'geen' && onbekend.reden === 'niet-gevonden')

  // Herbouwen is idempotent: twee keer draaien mag de index niet verdubbelen.
  const opnieuw = bouwNaamIndex(db)
  check('herbouwen levert hetzelfde aantal', opnieuw === gebouwd, `${opnieuw} vs ${gebouwd}`)
  const totaal = (db.prepare('SELECT COUNT(*) AS n FROM naam_index').get() as { n: number }).n
  check('en verdubbelt de tabel niet', totaal === gebouwd, `${totaal}`)

  db.close()
}

// ── Zelftest ─────────────────────────────────────────────────────────────────
if (process.env.SCENARIO_SELFTEST === '1') {
  check('ZELFTEST: deze check hoort te falen', false, 'ingespoten door SCENARIO_SELFTEST=1')
}

for (const n of notities) console.log(`  • ${n}`)
console.log(`${geslaagd}/${geslaagd + gezakt} checks geslaagd`)
process.exit(gezakt ? 1 : 0)
