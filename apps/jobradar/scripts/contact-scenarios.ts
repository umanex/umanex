/**
 * De regels rond contactopvolging: `lib/contact.ts` plus de twee tabellen uit `ddl.ts`.
 *
 * Geen netwerk, geen schijf, geen Next — de logica staat los van de routes juist zodat ze
 * hier uitgevoerd kan worden in plaats van gelezen.
 */
import Database from 'better-sqlite3'
import { SCHEMA_DDL } from '../lib/db/ddl'
import {
  MAX_NOTITIE,
  isSubjectType,
  keurContact,
  keurVolgendeActie,
  magGecontacteerdWorden,
  statusNaContact,
} from '../lib/contact'
import { KANALEN, type ItemStatus } from '../lib/db/schema'

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

const VANDAAG = '2026-09-09'
const geldig = { datum: '2026-09-08', kanaal: 'mail', notitie: '  gebeld  ' }

// ── 1. De datum van een contactmoment ────────────────────────────────────────
{
  const g = keurContact(geldig, VANDAAG)
  check('een geldig contactmoment wordt aanvaard', g.ok === true, g.ok ? '' : g.reden)
  check('de notitie wordt getrimd', g.ok === true && g.waarde.notitie === 'gebeld', g.ok ? String(g.waarde.notitie) : '—')

  check('vandaag mag', keurContact({ ...geldig, datum: VANDAAG }, VANDAAG).ok === true)
  check('vorig jaar mag', keurContact({ ...geldig, datum: '2025-01-02' }, VANDAAG).ok === true)

  // Een contactmoment beschrijft iets dat gebeurd is. "Morgen gebeld" is een volgende actie.
  const morgen = keurContact({ ...geldig, datum: '2026-09-10' }, VANDAAG)
  check('morgen mag niet', morgen.ok === false, morgen.ok ? 'aanvaard' : '')
  check(
    'en de weigering zegt waarom',
    morgen.ok === false && /toekomst/.test(morgen.reden),
    morgen.ok ? '' : morgen.reden
  )

  // `2026-02-30` past in het patroon maar niet in de kalender — een regex alleen laat hem door.
  const onbestaand = keurContact({ ...geldig, datum: '2026-02-30' }, VANDAAG)
  check('30 februari bestaat niet', onbestaand.ok === false, onbestaand.ok ? 'aanvaard' : '')
  for (const slecht of ['09-09-2026', '2026-9-9', '', 'gisteren', '2026-09-09T10:00:00Z']) {
    check(`"${slecht}" is geen geldige datum`, keurContact({ ...geldig, datum: slecht }, VANDAAG).ok === false)
  }
}

// ── 2. Het kanaal ────────────────────────────────────────────────────────────
{
  for (const k of KANALEN) {
    check(`kanaal ${k} wordt aanvaard`, keurContact({ ...geldig, kanaal: k }, VANDAAG).ok === true)
  }
  for (const slecht of ['post', 'MAIL', '', 'mail ; drop', null, 42]) {
    check(
      `kanaal ${JSON.stringify(slecht)} wordt geweigerd`,
      keurContact({ ...geldig, kanaal: slecht }, VANDAAG).ok === false
    )
  }
}

// ── 3. De notitie ────────────────────────────────────────────────────────────
{
  const opDeGrens = keurContact({ ...geldig, notitie: 'x'.repeat(MAX_NOTITIE) }, VANDAAG)
  check(`precies ${MAX_NOTITIE} tekens mag`, opDeGrens.ok === true, opDeGrens.ok ? '' : opDeGrens.reden)
  const erover = keurContact({ ...geldig, notitie: 'x'.repeat(MAX_NOTITIE + 1) }, VANDAAG)
  check(`${MAX_NOTITIE + 1} tekens mag niet`, erover.ok === false, erover.ok ? 'aanvaard' : '')
  const leeg = keurContact({ ...geldig, notitie: '   ' }, VANDAAG)
  check('een notitie van alleen spaties wordt null, geen lege string', leeg.ok === true && leeg.waarde.notitie === null)
  const geen = keurContact({ datum: geldig.datum, kanaal: geldig.kanaal }, VANDAAG)
  check('geen notitie is toegestaan', geen.ok === true && geen.waarde.notitie === null)
}

// ── 4. Wat een contactmoment met de status doet ──────────────────────────────
{
  const overgangen: [ItemStatus, ItemStatus][] = [
    ['new', 'contacted'],
    ['saved', 'contacted'],
    ['contacted', 'contacted'],
    // De scherpste: een afwijzing is een beslissing, en een contactmoment mag hem niet
    // stil terugdraaien.
    ['dismissed', 'dismissed'],
  ]
  for (const [van, naar] of overgangen) {
    check(`status ${van} → ${naar}`, statusNaContact(van) === naar, statusNaContact(van))
  }
}

// ── 5. De opt-out-rem ────────────────────────────────────────────────────────
{
  check('zonder opt-out mag contact', magGecontacteerdWorden(false).ok === true)
  const geweigerd = magGecontacteerdWorden(true)
  check('met opt-out mag het niet', geweigerd.ok === false)
  check(
    'en de weigering legt uit waarom',
    geweigerd.ok === false && /afgemeld/.test(geweigerd.reden),
    geweigerd.ok ? '' : geweigerd.reden
  )
}

// ── 6. De volgende actie ─────────────────────────────────────────────────────
{
  check('een actie in de toekomst mag', keurVolgendeActie({ datum: '2027-01-01', omschrijving: 'bellen' }).ok === true)
  // Een verlopen actie is precies wat de lijst bovenaan hoort te zetten.
  check('een actie in het verleden mag ook', keurVolgendeActie({ datum: '2020-01-01', omschrijving: 'bellen' }).ok === true)
  check('zonder omschrijving niet', keurVolgendeActie({ datum: '2027-01-01', omschrijving: '  ' }).ok === false)
  check('201 tekens niet', keurVolgendeActie({ datum: '2027-01-01', omschrijving: 'x'.repeat(201) }).ok === false)
  check('200 tekens wel', keurVolgendeActie({ datum: '2027-01-01', omschrijving: 'x'.repeat(200) }).ok === true)
  check('30 februari ook hier niet', keurVolgendeActie({ datum: '2026-02-30', omschrijving: 'bellen' }).ok === false)
}

// ── 7. Het subject-type ──────────────────────────────────────────────────────
{
  check('lead is een subject-type', isSubjectType('lead'))
  check('prospect is een subject-type', isSubjectType('prospect'))
  for (const slecht of ['job', '', 'LEAD', null, {}]) {
    check(`${JSON.stringify(slecht)} is er geen`, !isSubjectType(slecht))
  }
}

// ── 8. De tabellen zelf ──────────────────────────────────────────────────────
{
  const db = new Database(':memory:')
  db.exec(SCHEMA_DDL)

  const tabellen = (db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[])
    .map((r) => r.name)
  check('contact_moments bestaat', tabellen.includes('contact_moments'), tabellen.join(', '))
  check('next_actions bestaat', tabellen.includes('next_actions'), tabellen.join(', '))

  const voegToe = db.prepare(`INSERT INTO contact_moments
    (subject_type, subject_key, datum, kanaal, notitie, rechtsgrond, created_at)
    VALUES (?, ?, ?, 'mail', NULL, 'gerechtvaardigd belang', '2026-09-09T10:00:00Z')`)

  // Een lead en een prospect met hetzélfde getal als sleutel zijn twee bedrijven.
  voegToe.run('lead', '42', '2026-09-01')
  voegToe.run('prospect', '42', '2026-09-02')
  const perType = db
    .prepare(`SELECT subject_type, count(*) AS n FROM contact_moments GROUP BY subject_type`)
    .all() as { subject_type: string; n: number }[]
  check(
    'lead 42 en prospect 42 delen geen historiek',
    perType.length === 2 && perType.every((r) => r.n === 1),
    JSON.stringify(perType)
  )

  // Twee momenten op dezelfde dag blijven twee rijen: je kan iemand twee keer spreken.
  voegToe.run('lead', '7', '2026-09-03')
  voegToe.run('lead', '7', '2026-09-03')
  const zelfdeDag = (db.prepare(`SELECT count(*) AS n FROM contact_moments WHERE subject_key='7'`).get() as { n: number }).n
  check('twee momenten op dezelfde dag blijven twee rijen', zelfdeDag === 2, String(zelfdeDag))

  // Eén volgende actie per bedrijf: de tweede vervangt de eerste, hij komt er niet naast.
  const zetActie = db.prepare(`INSERT INTO next_actions (subject_type, subject_key, datum, omschrijving, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(subject_type, subject_key) DO UPDATE SET
      datum = excluded.datum, omschrijving = excluded.omschrijving, updated_at = excluded.updated_at`)
  zetActie.run('lead', '42', '2026-10-01', 'bellen', 'a')
  zetActie.run('lead', '42', '2026-11-01', 'mailen', 'b')
  const acties = db.prepare(`SELECT datum, omschrijving FROM next_actions WHERE subject_key='42'`).all() as {
    datum: string
    omschrijving: string
  }[]
  check('één volgende actie per bedrijf', acties.length === 1, String(acties.length))
  check('en de nieuwste wint', acties[0]?.omschrijving === 'mailen', JSON.stringify(acties[0]))

  db.close()
}

if (process.env.SCENARIO_SELFTEST === '1') {
  check('zelftest: deze check hoort te falen', false, 'opzettelijk')
}

const totaal = geslaagd + gezakt
console.log(`${geslaagd}/${totaal} checks geslaagd`)
process.exit(gezakt > 0 ? 1 : 0)
