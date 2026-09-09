import 'server-only'
import { and, eq } from 'drizzle-orm'
import { getDb } from './db'
import * as schema from './db/schema'
import type { ItemStatus, SubjectType } from './db/schema'

/**
 * Wat de app over één bedrijf weet vóór ze er een contactmoment aan hangt.
 *
 * Twee bronnen, één antwoord: een lead staat in `companies`, een prospect in
 * `prospect_status` — en die laatste rij hoeft niet te bestaan. Een ontbrekende rij is
 * geen fout maar de begintoestand: status `new`, geen opt-out.
 */
export type Onderwerp = {
  bestaat: boolean
  status: ItemStatus
  optOut: boolean
  rechtsgrond: string
}

const STANDAARD_GROND = 'gerechtvaardigd belang'

export async function leesOnderwerp(type: SubjectType, key: string): Promise<Onderwerp> {
  const db = getDb()

  if (type === 'lead') {
    const id = Number(key)
    if (!Number.isInteger(id) || id <= 0) {
      return { bestaat: false, status: 'new', optOut: false, rechtsgrond: STANDAARD_GROND }
    }
    const rij = (await db.select().from(schema.companies).where(eq(schema.companies.id, id)).limit(1))[0]
    if (!rij) return { bestaat: false, status: 'new', optOut: false, rechtsgrond: STANDAARD_GROND }
    return {
      bestaat: true,
      status: rij.leadStatus as ItemStatus,
      optOut: rij.optOut,
      rechtsgrond: rij.rechtsgrond || STANDAARD_GROND,
    }
  }

  const rij = (
    await db
      .select()
      .from(schema.prospectStatus)
      .where(eq(schema.prospectStatus.enterpriseNumber, key))
      .limit(1)
  )[0]
  // Geen rij betekent "nog niets over beslist", niet "bestaat niet": elk tiencijferig
  // nummer is een geldig onderwerp zodra het in de lijst staat.
  return {
    bestaat: true,
    status: (rij?.status as ItemStatus) ?? 'new',
    optOut: rij?.optOut ?? false,
    rechtsgrond: STANDAARD_GROND,
  }
}

/** Zet de status na een contactmoment, op de juiste tabel voor dit onderwerp. */
export async function zetStatus(type: SubjectType, key: string, status: ItemStatus, nu: string) {
  const db = getDb()
  if (type === 'lead') {
    await db.update(schema.companies).set({ leadStatus: status }).where(eq(schema.companies.id, Number(key)))
    return
  }
  await db
    .insert(schema.prospectStatus)
    .values({ enterpriseNumber: key, status, updatedAt: nu })
    .onConflictDoUpdate({
      target: schema.prospectStatus.enterpriseNumber,
      set: { status, updatedAt: nu },
    })
}

/** De historiek van één onderwerp, nieuwste eerst, plus zijn volgende actie. */
export async function leesOpvolging(type: SubjectType, key: string) {
  const db = getDb()
  const momenten = await db
    .select()
    .from(schema.contactMoments)
    .where(and(eq(schema.contactMoments.subjectType, type), eq(schema.contactMoments.subjectKey, key)))
  const actie = (
    await db
      .select()
      .from(schema.nextActions)
      .where(and(eq(schema.nextActions.subjectType, type), eq(schema.nextActions.subjectKey, key)))
      .limit(1)
  )[0]
  // Sorteren in JS en niet in SQL: de lijst is per bedrijf klein, en de volgorde hoort bij
  // de weergave. `datum` is ISO, dus een stringvergelijking is de chronologie.
  momenten.sort((a, b) => (a.datum === b.datum ? b.id - a.id : b.datum.localeCompare(a.datum)))
  return { momenten, actie: actie ?? null }
}
