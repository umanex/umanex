'use client'

import { Badge } from '@umanex/ui/components/ui/badge'

type NextActionBadgeProps = {
  /** ISO-datum van de volgende actie, of null wanneer er geen is. */
  datum: string | null
  omschrijving?: string | null
  /** ISO-datum van vandaag, meegegeven zodat het component zelf niets over tijd aanneemt. */
  vandaag: string
}

/**
 * De volgende actie op een kaart, met zijn datum-toestand.
 *
 * Vier toestanden en niet drie: "geen actie" is er één van. Een kaart zonder badge zou
 * betekenen dat je moet raden of er niets gepland staat of dat het component stuk is.
 *
 * De vergelijking gebeurt op ISO-strings en niet op `Date`: beide waarden zijn `YYYY-MM-DD`,
 * dus een stringvergelijking ís de chronologie — en `new Date('2026-09-09')` interpreteert
 * in UTC terwijl de gebruiker in een andere zone kan zitten, waardoor "vandaag" er een dag
 * naast ligt.
 */
export function NextActionBadge({ datum, omschrijving, vandaag }: NextActionBadgeProps) {
  if (!datum) {
    return (
      <Badge variant="outline" className="text-2xs">
        geen actie
      </Badge>
    )
  }

  const verlopen = datum < vandaag
  const isVandaag = datum === vandaag
  const label = verlopen ? 'verlopen' : isVandaag ? 'vandaag' : datum

  return (
    <Badge
      variant={verlopen ? 'destructive' : isVandaag ? 'warning' : 'secondary'}
      className="text-2xs"
      title={omschrijving ?? undefined}
    >
      {label}
      {verlopen && ` · ${datum}`}
    </Badge>
  )
}
