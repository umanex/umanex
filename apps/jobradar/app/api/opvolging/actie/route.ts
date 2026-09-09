import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { isSubjectType, keurVolgendeActie } from '@/lib/contact'

export const dynamic = 'force-dynamic'

/** Zet of vervangt de volgende actie. Eén per bedrijf — de tweede vervangt de eerste. */
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ ok: false, error: 'ongeldige body' }, { status: 400 })

  const type = body.type
  const key = typeof body.key === 'string' ? body.key : ''
  if (!isSubjectType(type) || !key) {
    return NextResponse.json({ ok: false, error: 'type en key zijn verplicht' }, { status: 400 })
  }

  const gekeurd = keurVolgendeActie(body)
  if (!gekeurd.ok) return NextResponse.json({ ok: false, error: gekeurd.reden }, { status: 400 })

  const nu = new Date().toISOString()
  const db = getDb()
  await db
    .insert(schema.nextActions)
    .values({ subjectType: type, subjectKey: key, ...gekeurd.waarde, updatedAt: nu })
    .onConflictDoUpdate({
      target: [schema.nextActions.subjectType, schema.nextActions.subjectKey],
      set: { ...gekeurd.waarde, updatedAt: nu },
    })

  return NextResponse.json({ ok: true, actie: { ...gekeurd.waarde } })
}

/** Haalt de volgende actie weg. Geen actie is een geldige toestand, geen fout. */
export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const key = url.searchParams.get('key')
  if (!isSubjectType(type) || !key) {
    return NextResponse.json({ ok: false, error: 'type en key zijn verplicht' }, { status: 400 })
  }

  const db = getDb()
  await db
    .delete(schema.nextActions)
    .where(and(eq(schema.nextActions.subjectType, type), eq(schema.nextActions.subjectKey, key)))

  return NextResponse.json({ ok: true })
}
