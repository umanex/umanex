import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { isSubjectType, keurContact, magGecontacteerdWorden, statusNaContact } from '@/lib/contact'
import { leesOnderwerp, leesOpvolging, zetStatus } from '@/lib/opvolging'

export const dynamic = 'force-dynamic'

/** De historiek van één bedrijf plus zijn volgende actie. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const key = url.searchParams.get('key')
  if (!isSubjectType(type) || !key) {
    return NextResponse.json({ ok: false, error: 'type en key zijn verplicht' }, { status: 400 })
  }

  const [onderwerp, opvolging] = await Promise.all([leesOnderwerp(type, key), leesOpvolging(type, key)])
  return NextResponse.json({ ok: true, ...opvolging, optOut: onderwerp.optOut, status: onderwerp.status })
}

/**
 * Legt één contactmoment vast.
 *
 * De opt-out-rem staat hier en niet alleen in het formulier: een guard die de UI kan
 * omzeilen beschermt niets. De rechtsgrond wordt overgenomen van het bedrijf op dít moment
 * — een register wil weten op welke grond je tóén contacteerde, en die kan later wijzigen.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ ok: false, error: 'ongeldige body' }, { status: 400 })

  const type = body.type
  const key = typeof body.key === 'string' ? body.key : ''
  if (!isSubjectType(type) || !key) {
    return NextResponse.json({ ok: false, error: 'type en key zijn verplicht' }, { status: 400 })
  }

  const vandaag = new Date().toISOString().slice(0, 10)
  const gekeurd = keurContact(body, vandaag)
  if (!gekeurd.ok) return NextResponse.json({ ok: false, error: gekeurd.reden }, { status: 400 })

  const onderwerp = await leesOnderwerp(type, key)
  if (!onderwerp.bestaat) {
    return NextResponse.json({ ok: false, error: 'onbekend bedrijf' }, { status: 404 })
  }

  const mag = magGecontacteerdWorden(onderwerp.optOut)
  if (!mag.ok) return NextResponse.json({ ok: false, error: mag.reden }, { status: 409 })

  const nu = new Date().toISOString()
  const db = getDb()
  const [rij] = await db
    .insert(schema.contactMoments)
    .values({
      subjectType: type,
      subjectKey: key,
      datum: gekeurd.waarde.datum,
      kanaal: gekeurd.waarde.kanaal,
      notitie: gekeurd.waarde.notitie,
      rechtsgrond: onderwerp.rechtsgrond,
      createdAt: nu,
    })
    .returning()

  const nieuweStatus = statusNaContact(onderwerp.status)
  if (nieuweStatus !== onderwerp.status) await zetStatus(type, key, nieuweStatus, nu)

  return NextResponse.json({ ok: true, moment: rij, status: nieuweStatus })
}
