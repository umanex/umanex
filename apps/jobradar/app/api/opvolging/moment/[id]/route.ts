import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import * as schema from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

/**
 * Verwijdert één contactmoment.
 *
 * De status blijft staan: die is een aparte beslissing, en hem terugdraaien omdat je een
 * notitie corrigeert zou een tweede ding doen dat niemand vroeg.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'ongeldig id' }, { status: 400 })
  }

  const db = getDb()
  const verwijderd = await db.delete(schema.contactMoments).where(eq(schema.contactMoments.id, id)).returning()
  if (!verwijderd.length) return NextResponse.json({ ok: false, error: 'niet gevonden' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
