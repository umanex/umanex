'use client'

import { Trash2 } from 'lucide-react'
import { Badge } from '@umanex/ui/components/ui/badge'
import { cn } from '@umanex/ui/lib/utils'
import { focusRing } from '@umanex/ui/lib/focus'
import type { ContactMoment } from '@/lib/db/schema'

const KANAAL_LABEL: Record<string, string> = {
  mail: 'Mail',
  linkedin: 'LinkedIn',
  telefoon: 'Telefoon',
  'in-persoon': 'In persoon',
}

type ContactTimelineProps = {
  momenten: ContactMoment[]
  /** Null zolang er niets verwijderd wordt; anders het id waarvoor bevestiging gevraagd is. */
  teVerwijderen: number | null
  onVerwijderVraag: (id: number | null) => void
  onVerwijderBevestig: (id: number) => void
  bezig: boolean
}

/**
 * De contactmomenten van één bedrijf, nieuwste eerst.
 *
 * Verwijderen vraagt bevestiging in twee stappen in plaats van een `confirm()`: die laatste
 * blokkeert de hele pagina en is niet te stylen, en in een sheet is hij bovendien een tweede
 * modaal bovenop een modaal.
 */
export function ContactTimeline({
  momenten,
  teVerwijderen,
  onVerwijderVraag,
  onVerwijderBevestig,
  bezig,
}: ContactTimelineProps) {
  if (!momenten.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nog geen contactmomenten. Leg hieronder het eerste vast — datum, kanaal en wat er uit
        kwam.
      </p>
    )
  }

  return (
    <ol className="space-y-3">
      {momenten.map((m) => (
        <li key={m.id} className="rounded-md border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium tabular-nums">{m.datum}</span>
              <Badge variant="secondary" className="text-2xs">
                {KANAAL_LABEL[m.kanaal] ?? m.kanaal}
              </Badge>
            </div>
            {teVerwijderen === m.id ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onVerwijderBevestig(m.id)}
                  disabled={bezig}
                  className={cn(
                    'rounded-md border border-destructive px-2 py-1 text-2xs text-destructive',
                    focusRing
                  )}
                >
                  Verwijderen
                </button>
                <button
                  type="button"
                  onClick={() => onVerwijderVraag(null)}
                  className={cn('rounded-md border px-2 py-1 text-2xs', focusRing)}
                >
                  Annuleren
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onVerwijderVraag(m.id)}
                aria-label={`Contactmoment van ${m.datum} verwijderen`}
                className={cn(
                  'rounded-sm p-1 text-muted-foreground hover:text-destructive',
                  focusRing
                )}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          {m.notitie && <p className="mt-1 whitespace-pre-wrap text-sm">{m.notitie}</p>}
          {/* De grond zoals die gold toen, niet zoals hij nu is — daarom staat hij op de rij. */}
          <p className="mt-1 text-2xs text-muted-foreground">grond: {m.rechtsgrond}</p>
        </li>
      ))}
    </ol>
  )
}
