/**
 * De regels rond contactmomenten en de volgende actie.
 *
 * Los van de routes en van de database, zodat `scripts/contact-scenarios.ts` ze kan
 * uitvoeren zonder Next, zonder netwerk en zonder schijf. Dezelfde reden dat `lib/db/ddl.ts`
 * los staat van `index.ts`.
 */
import { KANALEN, type ItemStatus, type Kanaal, type SubjectType } from './db/schema'

export const MAX_NOTITIE = 2000

export const SUBJECT_TYPES: readonly SubjectType[] = ['lead', 'prospect'] as const

export type ContactInvoer = {
  datum?: unknown
  kanaal?: unknown
  notitie?: unknown
}

export type Gekeurd<T> = { ok: true; waarde: T } | { ok: false; reden: string }

export type ContactWaarde = {
  datum: string
  kanaal: Kanaal
  notitie: string | null
}

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/

/** Bestaat deze datum echt? `2026-02-30` past in het patroon maar niet in de kalender. */
function echteDatum(s: string): boolean {
  const [j, m, d] = s.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(j, m - 1, d))
  return dt.getUTCFullYear() === j && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/**
 * Keurt de invoer voor één contactmoment.
 *
 * Een datum in het verleden mag: je legt achteraf vast wat je vorige week deed. Een datum
 * in de toekomst mag níet — een contactmoment beschrijft iets dat gebeurd is, en "morgen
 * gebeld" is een volgende actie. Die twee door elkaar laten lopen maakt de historiek
 * onbruikbaar als bewijs van wat er werkelijk gedaan is.
 */
export function keurContact(invoer: ContactInvoer, vandaag: string): Gekeurd<ContactWaarde> {
  const datum = typeof invoer.datum === 'string' ? invoer.datum.trim() : ''
  if (!ISO_DATUM.test(datum)) return { ok: false, reden: 'datum moet YYYY-MM-DD zijn' }
  if (!echteDatum(datum)) return { ok: false, reden: `${datum} bestaat niet` }
  if (datum > vandaag) return { ok: false, reden: 'een contactmoment ligt niet in de toekomst' }

  const kanaal = typeof invoer.kanaal === 'string' ? invoer.kanaal.trim() : ''
  if (!(KANALEN as readonly string[]).includes(kanaal)) {
    return { ok: false, reden: `kanaal moet een van ${KANALEN.join(', ')} zijn` }
  }

  const ruw = typeof invoer.notitie === 'string' ? invoer.notitie.trim() : ''
  if (ruw.length > MAX_NOTITIE) {
    return { ok: false, reden: `notitie is ${ruw.length} tekens, hoogstens ${MAX_NOTITIE}` }
  }

  return { ok: true, waarde: { datum, kanaal: kanaal as Kanaal, notitie: ruw === '' ? null : ruw } }
}

/**
 * Wat een contactmoment met de status doet.
 *
 * `dismissed` blijft `dismissed`: dat is een beslissing die je genomen hebt, en een
 * contactmoment mag hem niet stil terugdraaien — ook niet wanneer je het bedrijf later
 * alsnog spreekt. `contacted` blijft `contacted` (geen ruis bij het tweede gesprek).
 */
export function statusNaContact(huidig: ItemStatus): ItemStatus {
  return huidig === 'new' || huidig === 'saved' ? 'contacted' : huidig
}

/**
 * De opt-out-rem. Weigeren is meer waard dan achteraf kunnen aantonen dat je fout zat,
 * dus dit staat in de API en niet alleen in het formulier.
 */
export function magGecontacteerdWorden(optOut: boolean): Gekeurd<true> {
  if (optOut) {
    return {
      ok: false,
      reden: 'dit bedrijf heeft zich afgemeld — een contactmoment vastleggen kan niet',
    }
  }
  return { ok: true, waarde: true }
}

/**
 * Keurt een volgende actie. Hier mág de datum in de toekomst liggen — dat is het punt —
 * en een datum in het verleden ook: een verlopen actie is precies wat de lijst bovenaan
 * hoort te zetten.
 */
export function keurVolgendeActie(
  invoer: { datum?: unknown; omschrijving?: unknown }
): Gekeurd<{ datum: string; omschrijving: string }> {
  const datum = typeof invoer.datum === 'string' ? invoer.datum.trim() : ''
  if (!ISO_DATUM.test(datum)) return { ok: false, reden: 'datum moet YYYY-MM-DD zijn' }
  if (!echteDatum(datum)) return { ok: false, reden: `${datum} bestaat niet` }

  const omschrijving = typeof invoer.omschrijving === 'string' ? invoer.omschrijving.trim() : ''
  if (omschrijving === '') return { ok: false, reden: 'een volgende actie heeft een omschrijving nodig' }
  if (omschrijving.length > 200) return { ok: false, reden: 'omschrijving is hoogstens 200 tekens' }

  return { ok: true, waarde: { datum, omschrijving } }
}

/** Is dit een geldig subject-type? Gebruikt door de routes vóór ze de database raken. */
export function isSubjectType(v: unknown): v is SubjectType {
  return typeof v === 'string' && (SUBJECT_TYPES as readonly string[]).includes(v)
}
